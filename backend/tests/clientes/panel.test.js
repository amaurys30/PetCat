import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { api } from "../helpers/api.js";
import { crearCita, crearEmpleado, crearMascota, crearNegocio, crearRol, crearUsuario, tokenDe, unique } from "../helpers/factories.js";

const HOY = hoyISO();
const sumarDias = (fechaISO, dias) => {
  const fecha = new Date(`${fechaISO}T12:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  return hoyISO(fecha);
};

/** Clínica con tres clientes: Rosa (varias citas), Luis (solo una cancelada) y Marta (registrada en el panel). */
const contexto = async () => {
  const negocio = await crearNegocio(null, { nombre: `Clínica ${unique()}` });
  const token = await tokenDe(negocio.propietario);
  const rosa = await crearUsuario({ nombre: "Rosa", apellido: "Pérez", telefono: "300 111 2233" });
  const max = await crearMascota(rosa, { nombre: "Max", tiene_alergias: true, alergias_detalle: "Pollo" });
  const kira = await crearMascota(rosa, { nombre: "Kira", especie: "gato" });
  const luis = await crearUsuario({ nombre: "Luis", apellido: "Ávila" });
  const marta = await crearUsuario({ nombre: "Marta", apellido: "Zuleta" });

  const citaDe = (cliente, mascota, overrides) => crearCita(negocio, { cliente, mascota, ...overrides });
  await citaDe(rosa, max, { estado: "completada", fecha: sumarDias(HOY, -30) });
  await citaDe(rosa, max, { estado: "no_asistio", fecha: sumarDias(HOY, -20) });
  await citaDe(rosa, max, { estado: "no_asistio", fecha: sumarDias(HOY, -10) });
  await citaDe(rosa, max, { estado: "cancelada", cancelacion_tardia: true, fecha: sumarDias(HOY, -5) });
  const proxima = await citaDe(rosa, max, { estado: "confirmada", fecha: sumarDias(HOY, 3) });
  await citaDe(luis, await crearMascota(luis), { estado: "cancelada", fecha: sumarDias(HOY, -2) });
  await pool.query(
    "INSERT INTO autorizaciones_datos (id_usuario, canal, id_negocio, id_usuario_registro, version_politica) VALUES (?, 'panel', ?, ?, '1.0')",
    [marta.id_usuario, negocio.id_negocio, negocio.propietario.id_usuario]
  );
  return { negocio, token, rosa, max, kira, luis, marta, proxima };
};

const listar = (ctx, query = "", token = ctx.token) => api(token).get(`/negocios/${ctx.negocio.id_negocio}/clientes${query ? `?${query}` : ""}`);
const detalle = (ctx, id_usuario, token = ctx.token) => api(token).get(`/negocios/${ctx.negocio.id_negocio}/clientes/${id_usuario}`);

describe("GET /negocios/:id_negocio/clientes", () => {
  it("incluye clientes con citas en cualquier estado y los registrados en el panel, con sus conteos", async () => {
    const ctx = await contexto();
    await crearUsuario({ nombre: "Ajeno" });
    const res = await listar(ctx);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(3);
    // Orden por actividad más reciente: Rosa (cita futura), Luis y luego Marta (sin citas).
    expect(res.body.data.map((c) => c.nombre)).toEqual(["Rosa", "Luis", "Marta"]);
    expect(res.body.data[0]).toEqual({
      id_usuario: ctx.rosa.id_usuario,
      nombre: "Rosa",
      apellido: "Pérez",
      email: ctx.rosa.email,
      telefono: "300 111 2233",
      total_citas: 5,
      ultima_cita: sumarDias(HOY, -10),
      proxima_cita: sumarDias(HOY, 3),
      inasistencias: 2,
      usa_app: false,
      registrado_por_el_negocio: false,
      cliente_desde: sumarDias(HOY, -30),
    });
    expect(res.body.data[2]).toMatchObject({
      nombre: "Marta",
      total_citas: 0,
      ultima_cita: null,
      inasistencias: 0,
      registrado_por_el_negocio: true,
      cliente_desde: HOY,
    });
  });

  it("busca por nombre, teléfono y mascota; ordena por nombre o inasistencias", async () => {
    const ctx = await contexto();
    const nombres = async (query) => (await listar(ctx, query)).body.data.map((c) => c.nombre);
    expect(await nombres("q=rosa")).toEqual(["Rosa"]);
    expect(await nombres("q=111223")).toEqual(["Rosa"]);
    expect(await nombres("q=kira")).toEqual(["Rosa"]);
    expect(await nombres("orden=nombre")).toEqual(["Luis", "Rosa", "Marta"]);
    expect((await nombres("orden=inasistencias"))[0]).toBe("Rosa");
    expect((await listar(ctx, "orden=fecha")).status).toBe(422);
  });

  it("las cuentas desactivadas no aparecen; sin clientes.ver -> 403", async () => {
    const ctx = await contexto();
    await pool.query("UPDATE usuarios SET activo = FALSE WHERE id_usuario = ?", [ctx.luis.id_usuario]);
    expect((await listar(ctx)).body.data.map((c) => c.nombre)).toEqual(["Rosa", "Marta"]);

    const usuario = await crearUsuario();
    await crearEmpleado(ctx.negocio, { usuario, rol: (await crearRol(ctx.negocio, { inventario: ["ver"] })).id_rol });
    expect((await listar(ctx, "", await tokenDe(usuario))).status).toBe(403);
  });
});

describe("GET /negocios/:id_negocio/clientes/:id_usuario", () => {
  it("contacto, cumplimiento, mascotas con acceso al historial y citas próximas y recientes", async () => {
    const ctx = await contexto();
    const res = await detalle(ctx, ctx.rosa.id_usuario);

    expect(res.status).toBe(200);
    const { cliente, historial_cumplimiento, mascotas, citas } = res.body.data;
    expect(cliente).toEqual({
      id_usuario: ctx.rosa.id_usuario,
      nombre: "Rosa",
      apellido: "Pérez",
      email: ctx.rosa.email,
      telefono: "300 111 2233",
      cliente_desde: sumarDias(HOY, -30),
      registrado_por_el_negocio: false,
      usa_app: false,
      correo_editable: false,
    });
    expect(historial_cumplimiento).toEqual({ completadas: 1, inasistencias: 2, cancelaciones_tardias: 1 });
    expect(mascotas).toEqual([
      expect.objectContaining({ nombre: "Kira", citas_con_negocio: 0, acceso_historial: false }),
      expect.objectContaining({ nombre: "Max", citas_con_negocio: 5, acceso_historial: true, alergias_detalle: "Pollo" }),
    ]);
    expect(citas.proximas.map((c) => c.id_cita)).toEqual([ctx.proxima.id_cita]);
    expect(citas.proximas[0]).toHaveProperty("fuera_de_disponibilidad");
    expect(citas.recientes.map((c) => c.estado)).toEqual(["cancelada", "no_asistio", "no_asistio", "completada"]);
  });

  it("cuenta solo las citas de este negocio, nunca las de otros", async () => {
    const ctx = await contexto();
    const otro = await crearNegocio();
    for (let i = 0; i < 3; i++) {
      await crearCita(otro, { cliente: ctx.rosa, mascota: ctx.kira, estado: "no_asistio", fecha: sumarDias(HOY, -40 - i) });
    }
    await crearCita(otro, { cliente: ctx.rosa, mascota: ctx.kira, estado: "completada", fecha: sumarDias(HOY, -50) });

    const res = await detalle(ctx, ctx.rosa.id_usuario);
    expect(res.body.data.historial_cumplimiento).toEqual({ completadas: 1, inasistencias: 2, cancelaciones_tardias: 1 });
    expect(res.body.data.mascotas.find((m) => m.nombre === "Kira")).toMatchObject({ citas_con_negocio: 0, acceso_historial: false });
    expect(res.body.data.citas.recientes).toHaveLength(4);
    expect((await listar(ctx, "q=rosa")).body.data[0]).toMatchObject({ total_citas: 5, inasistencias: 2 });
  });

  it("registrado en el panel: registrado_por_el_negocio y cliente_desde de la autorización; usa_app tras iniciar sesión", async () => {
    const ctx = await contexto();
    const antes = await detalle(ctx, ctx.marta.id_usuario);
    expect(antes.body.data.cliente).toMatchObject({ registrado_por_el_negocio: true, cliente_desde: HOY, usa_app: false });
    expect(antes.body.data.citas).toEqual({ proximas: [], recientes: [] });

    await pool.query("UPDATE usuarios SET ultimo_acceso = NOW() WHERE id_usuario = ?", [ctx.marta.id_usuario]);
    expect((await detalle(ctx, ctx.marta.id_usuario)).body.data.cliente.usa_app).toBe(true);
  });

  it("no es cliente de este negocio, está desactivado o no existe -> 404; no expone datos sensibles", async () => {
    const ctx = await contexto();
    const otroNegocio = await crearNegocio();
    const soloDeOtro = await crearUsuario();
    await crearCita(otroNegocio, { cliente: soloDeOtro });
    await pool.query("UPDATE usuarios SET activo = FALSE WHERE id_usuario = ?", [ctx.luis.id_usuario]);

    for (const id of [soloDeOtro.id_usuario, ctx.luis.id_usuario, 999999999]) {
      const res = await detalle(ctx, id);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Cliente no encontrado en este negocio");
    }
    const ok = await detalle(ctx, ctx.rosa.id_usuario);
    for (const campo of ["password_hash", "token_recuperacion", "ultimo_acceso", "notif_email"]) {
      expect(JSON.stringify(ok.body)).not.toContain(campo);
    }
  });
});

describe("GET /negocios/:id_negocio/clientes/:id_usuario/citas", () => {
  it("todas las citas con el negocio, paginadas y filtrables por estado", async () => {
    const ctx = await contexto();
    const base = `/negocios/${ctx.negocio.id_negocio}/clientes/${ctx.rosa.id_usuario}/citas`;
    const todas = await api(ctx.token).get(`${base}?limit=2`);
    expect(todas.body.meta).toMatchObject({ total: 5, limit: 2, totalPages: 3 });
    const inasistencias = await api(ctx.token).get(`${base}?estado=no_asistio`);
    expect(inasistencias.body.data.map((c) => c.estado)).toEqual(["no_asistio", "no_asistio"]);
    expect((await api(ctx.token).get(`/negocios/${ctx.negocio.id_negocio}/clientes/999999999/citas`)).status).toBe(404);
  });
});

