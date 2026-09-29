import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { api } from "../helpers/api.js";
import {
  crearAdmin,
  crearCita,
  crearEmpleado,
  crearNegocio,
  crearSucursal,
  crearUsuario,
  tokenDe,
} from "../helpers/factories.js";
import { cruzaUmbralAviso, resolverPlan } from "../../src/modules/suscripciones/suscripcion.service.js";

/** Fecha calculada en MySQL ("YYYY-MM-DD"), p. ej. sql("CURDATE() + INTERVAL 14 DAY"). */
const sql = async (expresion) => {
  const [[row]] = await pool.query(`SELECT DATE_FORMAT(${expresion}, '%Y-%m-%d') AS fecha`);
  return row.fecha;
};

const suscripcionesDe = async (negocio) => {
  const [rows] = await pool.query(
    `SELECT p.nombre AS plan, s.estado, s.tipo_facturacion, s.fecha_inicio, s.fecha_fin, s.fecha_prueba_fin
     FROM suscripciones s JOIN planes_suscripcion p ON p.id_plan = s.id_plan
     WHERE s.id_negocio = ? ORDER BY s.id_suscripcion`,
    [negocio.id_negocio]
  );
  return rows;
};

const idPlan = async (nombre) => {
  const [[row]] = await pool.query("SELECT id_plan FROM planes_suscripcion WHERE nombre = ?", [nombre]);
  return row.id_plan;
};

describe("GET /planes", () => {
  it("es público y lista los planes en orden, con límites y características", async () => {
    const res = await api().get("/planes");
    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.nombre)).toEqual(["Gratuito", "Pro", "Enterprise"]);
    const [gratuito, pro] = res.body.data;
    expect(gratuito).toMatchObject({
      precio_mensual: 0,
      limites: { sucursales: 1, empleados: 3, citas_mes: 30, productos: 50 },
    });
    expect(pro).toMatchObject({
      precio_mensual: 120000,
      precio_anual: 1080000,
      limites: { sucursales: 3, empleados: -1, citas_mes: -1, productos: -1 },
      caracteristicas: { estadisticas_avanzadas: true, integracion_whatsapp: true, ia_recomendaciones: false },
    });
  });
});

describe("GET /negocios/:id_negocio/suscripcion", () => {
  it("devuelve el plan efectivo, la suscripción vigente y el uso de cada límite", async () => {
    const negocio = await crearNegocio();
    const hoy = await sql("CURDATE()");
    await crearSucursal(negocio);
    await crearSucursal(negocio, { activo: false });
    await crearEmpleado(negocio);
    await crearEmpleado(negocio);
    await crearEmpleado(negocio, { activo: false });
    // El propietario registrado como empleado no cuenta.
    await crearEmpleado(negocio, { usuario: negocio.propietario, rol: "Administrador" });
    // Citas del mes: cuentan todas menos canceladas y reprogramadas; las de otro mes no.
    await crearCita(negocio, { fecha: hoy, estado: "confirmada" });
    await crearCita(negocio, { fecha: hoy, estado: "no_asistio" });
    await crearCita(negocio, { fecha: hoy, estado: "cancelada" });
    await crearCita(negocio, { fecha: hoy, estado: "reprogramada" });
    await crearCita(negocio, { fecha: await sql("LAST_DAY(CURDATE()) + INTERVAL 1 DAY") });

    const res = await api(await tokenDe(negocio.propietario)).get(`/negocios/${negocio.id_negocio}/suscripcion`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      plan: { nombre: "Gratuito", limites: { citas_mes: 30 } },
      suscripcion: {
        plan: { nombre: "Gratuito" },
        estado: "activa",
        fecha_fin: "9999-12-31",
        fecha_prueba_fin: null,
        dias_prueba_restantes: null,
      },
      prueba_disponible: true,
      uso: {
        sucursales: { usadas: 1, maximo: 1 },
        empleados: { usadas: 2, maximo: 3 },
        citas_mes: { mes: hoy.slice(0, 7), usadas: 2, maximo: 30 },
        productos: { usadas: 0, maximo: 50 },
      },
    });
  });

  it("un empleado con configuracion.ver la consulta; sin ese permiso, 403", async () => {
    const negocio = await crearNegocio();
    const admin = await crearUsuario();
    await crearEmpleado(negocio, { usuario: admin, rol: "Administrador" });
    const recepcion = await crearUsuario();
    await crearEmpleado(negocio, { usuario: recepcion, rol: "Recepcionista" });

    expect((await api(await tokenDe(admin)).get(`/negocios/${negocio.id_negocio}/suscripcion`)).status).toBe(200);
    expect((await api(await tokenDe(recepcion)).get(`/negocios/${negocio.id_negocio}/suscripcion`)).status).toBe(403);
  });

  it("401 sin token, 403 de otro negocio, 404 si no existe y 422 con id inválido", async () => {
    const negocio = await crearNegocio();
    const token = await tokenDe((await crearNegocio()).propietario);
    expect((await api().get(`/negocios/${negocio.id_negocio}/suscripcion`)).status).toBe(401);
    expect((await api(token).get(`/negocios/${negocio.id_negocio}/suscripcion`)).status).toBe(403);
    expect((await api(token).get("/negocios/999999/suscripcion")).status).toBe(404);
    expect((await api(token).get("/negocios/abc/suscripcion")).status).toBe(422);
  });

  it("una prueba vencida cuenta como Gratuito aunque el cron no la haya marcado", async () => {
    const negocio = await crearNegocio();
    await pool.query(
      `INSERT INTO suscripciones (id_negocio, id_plan, estado, fecha_inicio, fecha_fin, fecha_prueba_fin)
       VALUES (?, ?, 'en_prueba', CURDATE() - INTERVAL 20 DAY, CURDATE() - INTERVAL 6 DAY, CURDATE() - INTERVAL 6 DAY)`,
      [negocio.id_negocio, await idPlan("Pro")]
    );
    const res = await api(await tokenDe(negocio.propietario)).get(`/negocios/${negocio.id_negocio}/suscripcion`);
    expect(res.body.data).toMatchObject({
      plan: { nombre: "Gratuito" },
      suscripcion: { plan: { nombre: "Pro" }, estado: "vencida", dias_prueba_restantes: null },
      prueba_disponible: false,
      uso: { sucursales: { maximo: 1 } },
    });
  });

  it("un plan pago vencido también cuenta como Gratuito", async () => {
    const negocio = await crearNegocio();
    await pool.query(
      `INSERT INTO suscripciones (id_negocio, id_plan, estado, fecha_inicio, fecha_fin)
       VALUES (?, ?, 'activa', CURDATE() - INTERVAL 1 MONTH, CURDATE() - INTERVAL 1 DAY)`,
      [negocio.id_negocio, await idPlan("Enterprise")]
    );
    const res = await api(await tokenDe(negocio.propietario)).get(`/negocios/${negocio.id_negocio}/suscripcion`);
    expect(res.body.data).toMatchObject({
      plan: { nombre: "Gratuito" },
      suscripcion: { plan: { nombre: "Enterprise" }, estado: "vencida" },
      prueba_disponible: true,
    });
  });
});

describe("POST /negocios/:id_negocio/suscripcion/prueba-pro", () => {
  it("el propietario activa 14 días de Pro; la suscripción Gratuita queda cancelada", async () => {
    const negocio = await crearNegocio();
    const res = await api(await tokenDe(negocio.propietario)).post(`/negocios/${negocio.id_negocio}/suscripcion/prueba-pro`);
    const [hoy, fin] = [await sql("CURDATE()"), await sql("CURDATE() + INTERVAL 14 DAY")];

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Prueba del plan Pro activada");
    expect(res.body.data).toMatchObject({
      plan: { nombre: "Pro", limites: { sucursales: 3, empleados: -1 } },
      suscripcion: { estado: "en_prueba", fecha_inicio: hoy, fecha_fin: fin, fecha_prueba_fin: fin, dias_prueba_restantes: 14 },
      prueba_disponible: false,
      uso: { citas_mes: { maximo: -1 } },
    });
    expect(await suscripcionesDe(negocio)).toEqual([
      expect.objectContaining({ plan: "Gratuito", estado: "cancelada", fecha_fin: hoy }),
      expect.objectContaining({ plan: "Pro", estado: "en_prueba", fecha_prueba_fin: fin }),
    ]);
  });

  it("409 si ya está en prueba, si ya la usó o si ya tiene un plan pago", async () => {
    const negocio = await crearNegocio();
    const token = await tokenDe(negocio.propietario);
    const ruta = `/negocios/${negocio.id_negocio}/suscripcion/prueba-pro`;
    expect((await api(token).post(ruta)).status).toBe(201);

    const otraVez = await api(token).post(ruta);
    expect(otraVez.status).toBe(409);
    expect(otraVez.body.message).toBe("El negocio ya tiene el plan Pro");

    // Vencida: vuelve al Gratuito, pero la prueba no se repite.
    await pool.query(
      `UPDATE suscripciones SET fecha_fin = CURDATE() - INTERVAL 1 DAY, fecha_prueba_fin = CURDATE() - INTERVAL 1 DAY
       WHERE id_negocio = ? AND estado = 'en_prueba'`,
      [negocio.id_negocio]
    );
    const vencida = await api(token).post(ruta);
    expect(vencida.status).toBe(409);
    expect(vencida.body.message).toBe("El negocio ya usó su prueba gratuita del plan Pro");

    const enterprise = await crearNegocio(null, { plan: "Enterprise" });
    const res = await api(await tokenDe(enterprise.propietario)).post(`/negocios/${enterprise.id_negocio}/suscripcion/prueba-pro`);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("El negocio ya tiene el plan Enterprise");
  });

  it("solo el propietario o el admin: un empleado con configuracion.editar recibe 403", async () => {
    const negocio = await crearNegocio();
    const empleado = await crearUsuario();
    await crearEmpleado(negocio, { usuario: empleado, rol: "Administrador" });
    const ruta = `/negocios/${negocio.id_negocio}/suscripcion/prueba-pro`;

    const res = await api(await tokenDe(empleado)).post(ruta);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Solo el propietario del negocio puede activar la prueba del plan Pro");

    expect((await api(await tokenDe(await crearAdmin())).post(ruta)).status).toBe(201);
  });

  it("401 sin token y 404 si el negocio no existe", async () => {
    expect((await api().post("/negocios/1/suscripcion/prueba-pro")).status).toBe(401);
    const token = await tokenDe(await crearUsuario());
    expect((await api(token).post("/negocios/999999/suscripcion/prueba-pro")).status).toBe(404);
  });
});

describe("PUT /negocios/:id_negocio/suscripcion (admin)", () => {
  it("asigna un plan mensual por un mes y deja el historial de suscripciones", async () => {
    const negocio = await crearNegocio();
    const token = await tokenDe(await crearAdmin());
    const res = await api(token)
      .put(`/negocios/${negocio.id_negocio}/suscripcion`)
      .send({ id_plan: await idPlan("Pro"), monto_pagado: 120000, notas: "Pago por transferencia" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Plan asignado");
    expect(res.body.data).toMatchObject({
      plan: { nombre: "Pro" },
      suscripcion: {
        estado: "activa",
        tipo_facturacion: "mensual",
        fecha_fin: await sql("CURDATE() + INTERVAL 1 MONTH"),
        monto_pagado: 120000,
      },
    });
    expect((await suscripcionesDe(negocio)).map((s) => [s.plan, s.estado])).toEqual([
      ["Gratuito", "cancelada"],
      ["Pro", "activa"],
    ]);
  });

  it("anual dura un año; con fecha_fin usa esa fecha; el Gratuito no vence", async () => {
    const negocio = await crearNegocio();
    const token = await tokenDe(await crearAdmin());
    const ruta = `/negocios/${negocio.id_negocio}/suscripcion`;

    const anual = await api(token).put(ruta).send({ id_plan: await idPlan("Enterprise"), tipo_facturacion: "anual" });
    expect(anual.body.data.suscripcion).toMatchObject({ tipo_facturacion: "anual", fecha_fin: await sql("CURDATE() + INTERVAL 1 YEAR") });

    const fecha_fin = await sql("CURDATE() + INTERVAL 45 DAY");
    const conFecha = await api(token).put(ruta).send({ id_plan: await idPlan("Pro"), fecha_fin });
    expect(conFecha.body.data.suscripcion.fecha_fin).toBe(fecha_fin);

    const gratuito = await api(token).put(ruta).send({ id_plan: await idPlan("Gratuito") });
    expect(gratuito.body.data).toMatchObject({ plan: { nombre: "Gratuito" }, suscripcion: { fecha_fin: "9999-12-31" } });
    expect((await suscripcionesDe(negocio)).map((s) => s.estado)).toEqual(["cancelada", "cancelada", "cancelada", "activa"]);
  });

  it("422: plan inexistente, fecha_fin en el Gratuito, fecha pasada y campos desconocidos", async () => {
    const negocio = await crearNegocio();
    const token = await tokenDe(await crearAdmin());
    const ruta = `/negocios/${negocio.id_negocio}/suscripcion`;

    const inexistente = await api(token).put(ruta).send({ id_plan: 999999 });
    expect(inexistente.status).toBe(422);
    expect(inexistente.body.errors).toEqual({ id_plan: "El plan no existe" });

    const gratuito = await api(token).put(ruta).send({ id_plan: await idPlan("Gratuito"), fecha_fin: await sql("CURDATE() + INTERVAL 1 MONTH") });
    expect(gratuito.status).toBe(422);
    expect(gratuito.body.errors).toEqual({ fecha_fin: "El plan Gratuito no vence" });

    const pasada = await api(token).put(ruta).send({ id_plan: await idPlan("Pro"), fecha_fin: await sql("CURDATE()"), estado: "activa" });
    expect(pasada.status).toBe(422);
    expect(Object.keys(pasada.body.errors).sort()).toEqual(["estado", "fecha_fin"]);
  });

  it("solo el admin de plataforma: el propietario recibe 403; 404 si el negocio no existe", async () => {
    const negocio = await crearNegocio();
    const body = { id_plan: await idPlan("Pro") };
    const propietario = await api(await tokenDe(negocio.propietario)).put(`/negocios/${negocio.id_negocio}/suscripcion`).send(body);
    expect(propietario.status).toBe(403);
    expect(propietario.body.message).toBe("Solo el administrador de la plataforma puede realizar esta acción");

    expect((await api(await tokenDe(await crearAdmin())).put("/negocios/999999/suscripcion").send(body)).status).toBe(404);
    expect((await api().put(`/negocios/${negocio.id_negocio}/suscripcion`).send(body)).status).toBe(401);
  });
});

describe("GET /negocios/mios con el plan", () => {
  it("cada negocio trae su plan efectivo y si está en prueba", async () => {
    const usuario = await crearUsuario();
    const gratuito = await crearNegocio(usuario);
    const enPrueba = await crearNegocio(usuario);
    await api(await tokenDe(usuario)).post(`/negocios/${enPrueba.id_negocio}/suscripcion/prueba-pro`);

    const res = await api(await tokenDe(usuario)).get("/negocios/mios");
    const porId = Object.fromEntries(res.body.data.map((n) => [n.id_negocio, n.plan]));
    expect(porId[gratuito.id_negocio]).toMatchObject({ nombre: "Gratuito", en_prueba: false });
    expect(porId[enPrueba.id_negocio]).toMatchObject({ nombre: "Pro", en_prueba: true });
  });
});

describe("cálculo del plan", () => {
  const planes = { 1: { id_plan: 1, nombre: "Gratuito" }, 2: { id_plan: 2, nombre: "Pro" } };

  it("sin suscripciones, Gratuito; la vigente es la más reciente activa o en prueba", () => {
    expect(resolverPlan([], planes)).toMatchObject({ suscripcion: null, plan: { nombre: "Gratuito" } });
    const filas = [
      { id_suscripcion: 1, id_plan: 2, estado: "activa", fecha_fin: "9999-12-31", fecha_prueba_fin: null },
      { id_suscripcion: 2, id_plan: 1, estado: "cancelada", fecha_fin: "9999-12-31", fecha_prueba_fin: null },
    ];
    expect(resolverPlan(filas, planes)).toMatchObject({ suscripcion: { id_suscripcion: 1 }, vencida: false, plan: { nombre: "Pro" } });
  });

  it("el aviso del 80 % lo dispara solo la reserva que cruza el umbral", () => {
    expect(cruzaUmbralAviso(22, 30)).toBe(false);
    expect(cruzaUmbralAviso(23, 30)).toBe(true); // la cita 24 de 30
    expect(cruzaUmbralAviso(24, 30)).toBe(false);
    expect(cruzaUmbralAviso(0, 1)).toBe(true);
    expect(cruzaUmbralAviso(5, -1)).toBe(false);
  });
});
