import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { api } from "../helpers/api.js";
import { crearAdmin, crearCita, crearNegocio, crearUsuario, tokenDe } from "../helpers/factories.js";

/** Administración de la plataforma (P6.5): negocios con su plan, historial y quién asignó cada plan. */

const idPlan = async (nombre) => {
  const [[row]] = await pool.query("SELECT id_plan FROM planes_suscripcion WHERE nombre = ?", [nombre]);
  return row.id_plan;
};

const unico = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

describe("GET /admin/negocios", () => {
  it("lista los negocios con su propietario, plan y estado efectivos y las citas del mes; filtra por q, plan y estado", async () => {
    const marca = `Admin E2E ${unico()}`;
    const gratuito = await crearNegocio(await crearUsuario({ email: `dueno.${unico()}@petcat.test` }), {
      nombre: `${marca} Clínica Ñandú`,
      ciudad: "Sincelejo",
    });
    await crearCita(gratuito, {});
    await crearNegocio(null, { nombre: `${marca} Peluquería`, plan: "Pro" });
    // Una prueba que ya venció cuenta como Gratuito y "vencida", aunque el job no la haya marcado.
    const vencida = await crearNegocio(null, { nombre: `${marca} Guardería` });
    await pool.query(
      `INSERT INTO suscripciones (id_negocio, id_plan, estado, fecha_inicio, fecha_fin, fecha_prueba_fin)
       VALUES (?, ?, 'en_prueba', CURDATE() - INTERVAL 20 DAY, CURDATE() - INTERVAL 6 DAY, CURDATE() - INTERVAL 6 DAY)`,
      [vencida.id_negocio, await idPlan("Pro")]
    );

    const admin = api(await tokenDe(await crearAdmin()));
    const res = await admin.get(`/admin/negocios?q=${encodeURIComponent(marca)}`);
    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ total: 3, page: 1 });
    const porNombre = Object.fromEntries(res.body.data.map((n) => [n.nombre, n]));
    expect(porNombre[`${marca} Clínica Ñandú`]).toMatchObject({
      plan: { nombre: "Gratuito" },
      estado: "activa",
      suscripcion: { estado: "activa", fecha_fin: "9999-12-31" },
      propietario: { email: gratuito.propietario.email },
      citas_mes: { usadas: 1, maximo: 30 },
    });
    expect(porNombre[`${marca} Peluquería`]).toMatchObject({ plan: { nombre: "Pro" }, citas_mes: { maximo: -1 } });
    expect(porNombre[`${marca} Guardería`]).toMatchObject({
      plan: { nombre: "Gratuito" },
      estado: "vencida",
      suscripcion: { plan: { nombre: "Pro" }, estado: "vencida" },
    });

    const nombres = async (query) =>
      (await admin.get(`/admin/negocios?q=${encodeURIComponent(marca)}&${query}`)).body.data.map((n) => n.nombre);
    expect(await nombres(`id_plan=${await idPlan("Pro")}`)).toEqual([`${marca} Peluquería`]);
    expect(await nombres("estado=vencida")).toEqual([`${marca} Guardería`]);
    // Sin distinguir tildes ni mayúsculas, también por el correo del propietario.
    expect((await admin.get(`/admin/negocios?q=${encodeURIComponent(`${marca} clinica nandu`)}`)).body.data).toHaveLength(1);
    expect((await admin.get(`/admin/negocios?q=${encodeURIComponent(gratuito.propietario.email)}`)).body.data[0].id_negocio).toBe(
      gratuito.id_negocio
    );
    // Paginación después de filtrar.
    const pagina = await admin.get(`/admin/negocios?q=${encodeURIComponent(marca)}&limit=2&page=2`);
    expect(pagina.body.data).toHaveLength(1);
    expect(pagina.body.meta).toMatchObject({ total: 3, page: 2, hasNext: false });
  });

  it("solo el super admin: otro usuario 403, sin token 401 y filtros inválidos 422", async () => {
    const negocio = await crearNegocio();
    expect((await api(await tokenDe(negocio.propietario)).get("/admin/negocios")).status).toBe(403);
    expect((await api().get("/admin/negocios")).status).toBe(401);
    const admin = api(await tokenDe(await crearAdmin()));
    expect((await admin.get("/admin/negocios?estado=cancelada")).status).toBe(422);
    expect((await admin.get("/admin/negocios?limit=500")).status).toBe(422);
  });
});

describe("quién asignó cada plan", () => {
  it("la asignación guarda al admin en la suscripción y en auditoria_global; el historial lo muestra", async () => {
    const negocio = await crearNegocio();
    const admin = await crearAdmin({ nombre: "Ana", apellido: "Admin" });
    const res = await api(await tokenDe(admin))
      .put(`/negocios/${negocio.id_negocio}/suscripcion`)
      .set("User-Agent", "Prueba admin")
      .send({ id_plan: await idPlan("Pro"), monto_pagado: 120000, notas: "Transferencia ref. 88213" });
    expect(res.status).toBe(200);

    const [[fila]] = await pool.query(
      "SELECT id_suscripcion, id_usuario_registro FROM suscripciones WHERE id_negocio = ? AND estado = 'activa'",
      [negocio.id_negocio]
    );
    expect(fila.id_usuario_registro).toBe(admin.id_usuario);

    const [[auditoria]] = await pool.query(
      "SELECT * FROM auditoria_global WHERE tabla_afectada = 'suscripciones' AND registro_id = ?",
      [fila.id_suscripcion]
    );
    expect(auditoria).toMatchObject({ id_usuario: admin.id_usuario, operacion: "INSERT", user_agent: "Prueba admin" });
    expect(auditoria.datos_antes_json).toMatchObject({ estado: "activa", fecha_fin: "9999-12-31" });
    expect(auditoria.datos_despues_json).toMatchObject({
      id_negocio: negocio.id_negocio,
      plan: "Pro",
      estado: "activa",
      monto_pagado: 120000,
      notas: "Transferencia ref. 88213",
    });

    const historial = await api(await tokenDe(await crearAdmin())).get(`/admin/negocios/${negocio.id_negocio}/suscripciones`);
    expect(historial.status).toBe(200);
    expect(historial.body.data).toMatchObject([
      {
        plan: { nombre: "Pro" },
        estado: "activa",
        monto_pagado: 120000,
        notas: "Transferencia ref. 88213",
        registrada_por: { id_usuario: admin.id_usuario, nombre: "Ana", apellido: "Admin", es_admin: true },
      },
      { plan: { nombre: "Gratuito" }, estado: "cancelada", registrada_por: null },
    ]);
  });

  it("la prueba Pro guarda al propietario que la activó; el historial pide admin y un negocio existente", async () => {
    const negocio = await crearNegocio();
    await api(await tokenDe(negocio.propietario)).post(`/negocios/${negocio.id_negocio}/suscripcion/prueba-pro`);
    const admin = api(await tokenDe(await crearAdmin()));
    const historial = await admin.get(`/admin/negocios/${negocio.id_negocio}/suscripciones`);
    expect(historial.body.data[0]).toMatchObject({
      estado: "en_prueba",
      registrada_por: { id_usuario: negocio.propietario.id_usuario, es_admin: false },
    });
    expect((await api(await tokenDe(negocio.propietario)).get(`/admin/negocios/${negocio.id_negocio}/suscripciones`)).status).toBe(403);
    expect((await admin.get("/admin/negocios/999999/suscripciones")).status).toBe(404);
  });
});
