import { beforeEach, describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { api } from "../helpers/api.js";
import {
  crearAdmin,
  crearCita,
  crearEmpleado,
  crearNegocio,
  crearRol,
  crearServicio,
  crearUsuario,
  sinSilencio,
  tokenDe,
} from "../helpers/factories.js";

/** Reseñas (2.6): crear, editar, retirar, lo público, el panel y la cita del dueño. */

beforeEach(() => sinSilencio());

/** "YYYY-MM-DD HH:MM:SS" de hace `dias` días (hora de la base). */
const haceDias = async (dias) => {
  const [[{ fecha }]] = await pool.query("SELECT DATE_FORMAT(NOW() - INTERVAL ? DAY, '%Y-%m-%d %H:%i:%s') AS fecha", [dias]);
  return fecha;
};

/** Cita completada hace `dias` días de `cliente` en `negocio` (los crea si no vienen). */
const citaCompletada = async ({ negocio, cliente, dias = 1, servicio } = {}) => {
  const n = negocio ?? (await crearNegocio(null, { nombre: "Clínica Patitas" }));
  const c = cliente ?? (await crearUsuario({ nombre: "Sofía", apellido: "gómez" }));
  const completada = await haceDias(dias);
  const cita = await crearCita(n, {
    cliente: c,
    servicio: servicio ?? (await crearServicio(n, { nombre: "Consulta general" })),
    estado: "completada",
    fecha: completada.slice(0, 10),
    fecha_completada: completada,
  });
  return { negocio: n, cliente: c, cita, token: await tokenDe(c) };
};

const resenar = (ctx, body = { calificacion: 5 }) => api(ctx.token).post(`/citas/${ctx.cita.id_cita}/resena`).send(body);

const negocioFila = async (id_negocio) => {
  const [[row]] = await pool.query("SELECT calificacion_promedio, total_resenas FROM negocios WHERE id_negocio = ?", [id_negocio]);
  return row;
};

const notificaciones = async (tipo, ids) => {
  const [rows] = await pool.query("SELECT id_usuario, mensaje FROM notificaciones WHERE tipo = ? AND id_usuario IN (?) ORDER BY id_usuario", [
    tipo,
    ids,
  ]);
  return rows;
};

describe("POST /citas/:id_cita/resena", () => {
  it("el dueño reseña su cita completada: actualiza la calificación y avisa a quien puede responder", async () => {
    const ctx = await citaCompletada();
    const admin = await crearUsuario();
    const vet = await crearUsuario();
    await crearEmpleado(ctx.negocio, { usuario: admin, rol: "Administrador" });
    await crearEmpleado(ctx.negocio, { usuario: vet, rol: "Veterinario" });

    const res = await resenar(ctx, {
      calificacion: 4,
      titulo: "Muy buena atención",
      comentario: "Atendieron rápido a Max.",
      aspectos: { atencion: 5, puntualidad: 3 },
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      calificacion: 4,
      titulo: "Muy buena atención",
      aspectos: { atencion: 5, precio: null, instalaciones: null, puntualidad: 3 },
      id_cita: ctx.cita.id_cita,
      negocio: { id_negocio: ctx.negocio.id_negocio, nombre: "Clínica Patitas" },
      servicio: { nombre: "Consulta general" },
      visible: true,
      respuesta: null,
      editada_despues_de_respuesta: false,
      puede_editar: true,
    });
    expect(await negocioFila(ctx.negocio.id_negocio)).toEqual({ calificacion_promedio: "4.00", total_resenas: 1 });

    const avisos = await notificaciones("resena_nueva", [ctx.negocio.propietario.id_usuario, admin.id_usuario, vet.id_usuario, ctx.cliente.id_usuario]);
    expect(avisos.map((a) => a.id_usuario).sort()).toEqual([ctx.negocio.propietario.id_usuario, admin.id_usuario].sort());
    expect(avisos[0].mensaje).toContain('Sofía gómez calificó con 4 estrellas Consulta general');

    const [[fila]] = await pool.query("SELECT cliente_registrado_por_negocio FROM resenas WHERE id_resena = ?", [res.body.data.id_resena]);
    expect(fila.cliente_registrado_por_negocio).toBe(0);
  });

  it("cita ajena 403, inexistente 404, no completada 409, repetida 409 y calificaciones fuera de rango 422", async () => {
    const ctx = await citaCompletada();
    const otro = await tokenDe(await crearUsuario());
    expect((await api(otro).post(`/citas/${ctx.cita.id_cita}/resena`).send({ calificacion: 5 })).status).toBe(403);
    expect((await api(otro).post("/citas/999999999/resena").send({ calificacion: 5 })).status).toBe(404);

    const pendiente = await crearCita(ctx.negocio, { cliente: ctx.cliente });
    const noCompletada = await api(ctx.token).post(`/citas/${pendiente.id_cita}/resena`).send({ calificacion: 5 });
    expect(noCompletada.status).toBe(409);
    expect(noCompletada.body.message).toBe("Solo se reseñan citas completadas");

    const invalida = await resenar(ctx, { calificacion: 6, aspectos: { precio: 0 } });
    expect(invalida.status).toBe(422);
    expect(Object.keys(invalida.body.errors).sort()).toEqual(["aspectos.precio", "calificacion"]);

    expect((await resenar(ctx)).status).toBe(201);
    const repetida = await resenar(ctx);
    expect(repetida.status).toBe(409);
    expect(repetida.body.message).toBe("Ya reseñaste esta cita");
  });

  it("después de 30 días de completada la cita, 409", async () => {
    const ctx = await citaCompletada({ dias: 31 });
    const res = await resenar(ctx);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Terminó el plazo de 30 días para reseñar después de la cita");
  });

  it("el propietario y los empleados activos no pueden reseñar el negocio; un ex empleado sí", async () => {
    const negocio = await crearNegocio();
    const delPropietario = await citaCompletada({ negocio, cliente: negocio.propietario });
    const res = await resenar(delPropietario);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("El propietario y los empleados del negocio no pueden reseñarlo");

    const empleado = await citaCompletada({ negocio });
    const fila = await crearEmpleado(negocio, { usuario: empleado.cliente, rol: "Recepcionista" });
    expect((await resenar(empleado)).status).toBe(403);

    await pool.query("UPDATE empleados SET activo = FALSE WHERE id_empleado = ?", [fila.id_empleado]);
    expect((await resenar(empleado)).status).toBe(201);
  });

  it("cliente registrado desde el panel del negocio: la señal se guarda y solo la ve el super admin", async () => {
    const ctx = await citaCompletada();
    await pool.query(
      "INSERT INTO autorizaciones_datos (id_usuario, canal, id_negocio, id_usuario_registro, version_politica) VALUES (?, 'panel', ?, ?, '1.0')",
      [ctx.cliente.id_usuario, ctx.negocio.id_negocio, ctx.negocio.propietario.id_usuario]
    );
    const creada = await resenar(ctx);
    expect(creada.body.data).not.toHaveProperty("cliente_registrado_por_negocio");
    const [[fila]] = await pool.query("SELECT cliente_registrado_por_negocio FROM resenas WHERE id_resena = ?", [creada.body.data.id_resena]);
    expect(fila.cliente_registrado_por_negocio).toBe(1);

    const url = `/negocios/${ctx.negocio.id_negocio}/resenas`;
    const panel = await api(await tokenDe(ctx.negocio.propietario)).get(`${url}/gestion`);
    expect(panel.body.data[0]).not.toHaveProperty("cliente_registrado_por_negocio");
    expect((await api().get(url)).body.data[0]).not.toHaveProperty("cliente_registrado_por_negocio");

    const admin = await api(await tokenDe(await crearAdmin())).get(`${url}/gestion`);
    expect(admin.body.data[0].cliente_registrado_por_negocio).toBe(true);
  });
});

describe("editar y retirar la reseña", () => {
  it("el autor la reemplaza dentro del plazo; si fue después de la respuesta, queda marcado", async () => {
    const ctx = await citaCompletada();
    const { id_resena } = (await resenar(ctx, { calificacion: 5, titulo: "Excelente", aspectos: { atencion: 5 } })).body.data;
    await api(await tokenDe(ctx.negocio.propietario)).put(`/resenas/${id_resena}/respuesta`).send({ respuesta: "¡Gracias!" });
    await pool.query("UPDATE resenas SET fecha_respuesta = NOW() - INTERVAL 1 MINUTE WHERE id_resena = ?", [id_resena]);

    const res = await api(ctx.token).put(`/resenas/${id_resena}`).send({ calificacion: 2, comentario: "Me cobraron de más" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      calificacion: 2,
      titulo: null,
      comentario: "Me cobraron de más",
      aspectos: { atencion: null },
      editada_despues_de_respuesta: true,
      respuesta: { texto: "¡Gracias!", editada: false },
    });
    expect(res.body.data.fecha_edicion).not.toBeNull();
    expect(await negocioFila(ctx.negocio.id_negocio)).toEqual({ calificacion_promedio: "2.00", total_resenas: 1 });

    const ajeno = await api(await tokenDe(await crearUsuario())).put(`/resenas/${id_resena}`).send({ calificacion: 1 });
    expect(ajeno.status).toBe(404);

    await pool.query("UPDATE citas SET fecha_completada = NOW() - INTERVAL 31 DAY WHERE id_cita = ?", [ctx.cita.id_cita]);
    const tarde = await api(ctx.token).put(`/resenas/${id_resena}`).send({ calificacion: 3 });
    expect(tarde.status).toBe(409);
    expect(tarde.body.message).toBe("Terminó el plazo de 30 días para editar la reseña después de la cita");
  });

  it("retirarla: deja de verse y de contar, no se reseña otra vez y el negocio ya no la encuentra", async () => {
    const ctx = await citaCompletada();
    const { id_resena } = (await resenar(ctx)).body.data;

    expect((await api(ctx.token).delete(`/resenas/${id_resena}`)).status).toBe(200);
    expect(await negocioFila(ctx.negocio.id_negocio)).toEqual({ calificacion_promedio: "0.00", total_resenas: 0 });
    expect((await api().get(`/negocios/${ctx.negocio.id_negocio}/resenas`)).body.data).toEqual([]);
    expect((await api(ctx.token).get("/resenas/mias")).body.data).toEqual([]);

    const otraVez = await resenar(ctx);
    expect(otraVez.status).toBe(409);
    expect(otraVez.body.message).toBe("Retiraste la reseña de esta cita: no se puede reseñar otra vez");
    expect((await api(ctx.token).put(`/resenas/${id_resena}`).send({ calificacion: 4 })).status).toBe(404);
    expect((await api(ctx.token).delete(`/resenas/${id_resena}`)).status).toBe(404);

    const negocio = api(await tokenDe(ctx.negocio.propietario));
    expect((await negocio.put(`/resenas/${id_resena}/respuesta`).send({ respuesta: "Hola" })).status).toBe(404);
    expect((await negocio.get(`/negocios/${ctx.negocio.id_negocio}/resenas/gestion`)).body.data).toEqual([]);

    const cita = await api(ctx.token).get(`/citas/${ctx.cita.id_cita}`);
    expect(cita.body.data).toMatchObject({ id_resena: null, resena: { retirada: true, puede_resenar: false, puede_editar: false } });
  });
});

describe("GET /negocios/:id_negocio/resenas (público)", () => {
  it("solo las visibles, autor 'Nombre I.' y mes de la visita, sin datos de contacto; una reportada sigue ahí", async () => {
    const negocio = await crearNegocio(null, { nombre: "Clínica Patitas" });
    const sofia = await citaCompletada({ negocio, dias: 3 });
    const luis = await citaCompletada({ negocio, cliente: await crearUsuario({ nombre: "Luis", apellido: "" }) });
    const oculta = await citaCompletada({ negocio });
    await resenar(sofia, { calificacion: 5, comentario: "Excelente" });
    const reportada = (await resenar(luis, { calificacion: 2, comentario: "Malo" })).body.data;
    const moderada = (await resenar(oculta, { calificacion: 1 })).body.data;
    await pool.query("UPDATE resenas SET visible = FALSE WHERE id_resena = ?", [moderada.id_resena]);
    await api(await tokenDe(negocio.propietario))
      .post(`/resenas/${reportada.id_resena}/reportar`)
      .send({ motivo: "lenguaje_ofensivo" });

    const res = await api().get(`/negocios/${negocio.id_negocio}/resenas`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => [r.autor, r.calificacion])).toEqual([
      ["Luis", 2],
      ["Sofía G.", 5],
    ]);
    expect(res.body.data[1].visita_verificada).toBe(sofia.cita.fecha.slice(0, 7));
    for (const r of res.body.data) {
      expect(Object.keys(r).sort()).toEqual(
        [
          "aspectos",
          "autor",
          "calificacion",
          "comentario",
          "editada_despues_de_respuesta",
          "fecha_creacion",
          "fecha_edicion",
          "id_resena",
          "respuesta",
          "titulo",
          "visita_verificada",
        ].sort()
      );
    }
    expect(res.body.meta).toMatchObject({
      total: 2,
      resumen: { calificacion_promedio: 3.5, total_resenas: 2, distribucion: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 1 } },
    });

    const perfil = await api().get(`/negocios/${negocio.id_negocio}`);
    expect(perfil.body.data.resenas_recientes.map((r) => r.autor)).toEqual(["Luis", "Sofía G."]);
  });

  it("orden, filtro por calificación y 404 si el negocio está inactivo", async () => {
    const negocio = await crearNegocio();
    for (const calificacion of [3, 5, 1]) await resenar(await citaCompletada({ negocio }), { calificacion });
    const url = `/negocios/${negocio.id_negocio}/resenas`;

    expect((await api().get(`${url}?orden=mejores`)).body.data.map((r) => r.calificacion)).toEqual([5, 3, 1]);
    expect((await api().get(`${url}?orden=peores`)).body.data.map((r) => r.calificacion)).toEqual([1, 3, 5]);
    expect((await api().get(`${url}?calificacion=3`)).body.data.map((r) => r.calificacion)).toEqual([3]);
    expect((await api().get(`${url}?orden=azar`)).status).toBe(422);

    await pool.query("UPDATE negocios SET activo = FALSE WHERE id_negocio = ?", [negocio.id_negocio]);
    expect((await api().get(url)).status).toBe(404);
  });
});

describe("panel", () => {
  it("gestión: requiere resenas.ver; trae las ocultas por moderación, el reporte y los filtros", async () => {
    const ctx = await citaCompletada();
    const otra = await citaCompletada({ negocio: ctx.negocio });
    const { id_resena } = (await resenar(ctx, { calificacion: 4 })).body.data;
    const moderada = (await resenar(otra, { calificacion: 1 })).body.data;
    await pool.query("UPDATE resenas SET visible = FALSE WHERE id_resena = ?", [moderada.id_resena]);
    const url = `/negocios/${ctx.negocio.id_negocio}/resenas/gestion`;

    const recepcion = await crearUsuario();
    await crearEmpleado(ctx.negocio, { usuario: recepcion, rol: "Recepcionista" });
    const res = await api(await tokenDe(recepcion)).get(url);
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => [r.id_resena, r.visible])).toEqual([
      [moderada.id_resena, false],
      [id_resena, true],
    ]);
    expect(res.body.data[1]).toMatchObject({
      cliente: { id_usuario: ctx.cliente.id_usuario, nombre: "Sofía", apellido: "gómez" },
      cita: { id_cita: ctx.cita.id_cita, servicio: { nombre: "Consulta general" } },
      reporte: null,
    });

    const sinPermiso = await crearUsuario();
    await crearEmpleado(ctx.negocio, { usuario: sinPermiso, rol: (await crearRol(ctx.negocio, { citas: ["ver"] })).id_rol });
    expect((await api(await tokenDe(sinPermiso)).get(url)).status).toBe(403);

    const propietario = api(await tokenDe(ctx.negocio.propietario));
    await propietario.post(`/resenas/${id_resena}/reportar`).send({ motivo: "spam" });
    await propietario.put(`/resenas/${moderada.id_resena}/respuesta`).send({ respuesta: "Lo sentimos" });
    expect((await propietario.get(`${url}?reportada=true`)).body.data.map((r) => r.id_resena)).toEqual([id_resena]);
    expect((await propietario.get(`${url}?sin_responder=true`)).body.data.map((r) => r.id_resena)).toEqual([id_resena]);
    expect((await propietario.get(`${url}?visible=false`)).body.data.map((r) => r.id_resena)).toEqual([moderada.id_resena]);
  });

  it("responder: requiere resenas.responder; la primera avisa al dueño, las ediciones no; se puede borrar", async () => {
    const ctx = await citaCompletada();
    const { id_resena } = (await resenar(ctx)).body.data;
    const url = `/resenas/${id_resena}/respuesta`;

    const vet = await crearUsuario();
    await crearEmpleado(ctx.negocio, { usuario: vet, rol: "Veterinario" });
    expect((await api(await tokenDe(vet)).put(url).send({ respuesta: "Gracias" })).status).toBe(403);

    const admin = await crearUsuario();
    await crearEmpleado(ctx.negocio, { usuario: admin, rol: "Administrador" });
    const panel = api(await tokenDe(admin));
    const primera = await panel.put(url).send({ respuesta: "Gracias por venir" });
    expect(primera.status).toBe(200);
    expect(primera.body.data.respuesta).toMatchObject({ texto: "Gracias por venir", editada: false });

    const editada = await panel.put(url).send({ respuesta: "Gracias por venir, Sofía" });
    expect(editada.body.data.respuesta).toMatchObject({ texto: "Gracias por venir, Sofía", editada: true });
    expect(await notificaciones("resena_respondida", [ctx.cliente.id_usuario])).toHaveLength(1);

    const borrada = await panel.delete(url);
    expect(borrada.status).toBe(200);
    expect(borrada.body.data.respuesta).toBeNull();
    expect((await panel.delete(url)).status).toBe(409);
    await panel.put(url).send({ respuesta: "Otra vez gracias" });
    expect(await notificaciones("resena_respondida", [ctx.cliente.id_usuario])).toHaveLength(1);

    const publica = (await api().get(`/negocios/${ctx.negocio.id_negocio}/resenas`)).body.data[0];
    expect(publica.respuesta.texto).toBe("Otra vez gracias");
  });

  it("reportar: una vez, requiere resenas.reportar; la reseña sigue visible y contando", async () => {
    const ctx = await citaCompletada();
    const { id_resena } = (await resenar(ctx, { calificacion: 1, comentario: "Pésimo" })).body.data;
    const url = `/resenas/${id_resena}/reportar`;

    const recepcion = await crearUsuario();
    await crearEmpleado(ctx.negocio, { usuario: recepcion, rol: "Recepcionista" });
    expect((await api(await tokenDe(recepcion)).post(url).send({ motivo: "spam" })).status).toBe(403);

    const propietario = api(await tokenDe(ctx.negocio.propietario));
    const sinDetalle = await propietario.post(url).send({ motivo: "otro" });
    expect(sinDetalle.status).toBe(422);
    expect(sinDetalle.body.errors).toEqual({ detalle: "Describe el motivo cuando es otro" });

    const res = await propietario.post(url).send({ motivo: "otro", detalle: "No es cliente nuestro" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      visible: true,
      reporte: {
        motivo: "otro",
        detalle: "No es cliente nuestro",
        reportada_por: { id_usuario: ctx.negocio.propietario.id_usuario },
      },
    });
    expect((await propietario.post(url).send({ motivo: "spam" })).status).toBe(409);

    expect((await api().get(`/negocios/${ctx.negocio.id_negocio}/resenas`)).body.data.map((r) => r.id_resena)).toEqual([id_resena]);
    expect(await negocioFila(ctx.negocio.id_negocio)).toEqual({ calificacion_promedio: "1.00", total_resenas: 1 });
  });
});

describe("la reseña en la cita del dueño", () => {
  it("puede_resenar hasta reseñar; después puede_editar; null en citas no completadas", async () => {
    const ctx = await citaCompletada({ dias: 2 });
    const pendiente = await crearCita(ctx.negocio, { cliente: ctx.cliente });

    const antes = await api(ctx.token).get(`/citas/${ctx.cita.id_cita}`);
    const [fecha, hora] = ctx.cita.fecha_completada.split(" ");
    const limite = new Date(`${fecha}T${hora}`);
    limite.setDate(limite.getDate() + 30);
    expect(antes.body.data).toMatchObject({
      fecha_completada: ctx.cita.fecha_completada,
      id_resena: null,
      resena: { id_resena: null, retirada: false, puede_resenar: true, puede_editar: false },
    });
    expect(antes.body.data.resena.resenar_antes_de.slice(0, 10)).toBe(
      `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, "0")}-${String(limite.getDate()).padStart(2, "0")}`
    );

    const { id_resena } = (await resenar(ctx)).body.data;
    const mias = await api(ctx.token).get("/citas/mias?alcance=todas");
    const porId = Object.fromEntries(mias.body.data.map((c) => [c.id_cita, c]));
    expect(porId[ctx.cita.id_cita].resena).toMatchObject({ id_resena, puede_resenar: false, puede_editar: true });
    expect(porId[pendiente.id_cita].resena).toBeNull();

    const panel = await api(await tokenDe(ctx.negocio.propietario)).get(`/citas/${ctx.cita.id_cita}`);
    expect(panel.body.data.id_resena).toBe(id_resena);
    expect(panel.body.data).not.toHaveProperty("resena");

    const misResenas = await api(ctx.token).get("/resenas/mias");
    expect(misResenas.body.data.map((r) => r.id_resena)).toEqual([id_resena]);
    expect(misResenas.body.meta.total).toBe(1);
  });
});
