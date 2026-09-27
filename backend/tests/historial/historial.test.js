import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { api } from "../helpers/api.js";
import {
  crearCita,
  crearEmpleado,
  crearHistorial,
  crearMascota,
  crearNegocio,
  crearUsuario,
  tokenDe,
} from "../helpers/factories.js";

const HOY = hoyISO();
const sumarDias = (fechaISO, dias) => {
  const fecha = new Date(`${fechaISO}T12:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  return hoyISO(fecha);
};

/**
 * Cliente con una mascota que tiene citas en dos clínicas (A y B). A tiene una
 * veterinaria con cuenta. Cada clínica ya registró una consulta con notas internas.
 */
const contexto = async ({ mascota: extraMascota = {} } = {}) => {
  const cliente = await crearUsuario();
  const mascota = await crearMascota(cliente, { nombre: "Toby", peso: 10, ...extraMascota });
  const clinicaA = await crearNegocio(null, { nombre: "Clínica A" });
  const clinicaB = await crearNegocio(null, { nombre: "Clínica B" });
  const usuarioVet = await crearUsuario();
  const vet = await crearEmpleado(clinicaA, { usuario: usuarioVet, rol: "Veterinario", nombre: "Vera" });
  const citaA = await crearCita(clinicaA, { cliente, mascota, estado: "completada", fecha: sumarDias(HOY, -20) });
  await crearCita(clinicaB, { cliente, mascota, estado: "completada", fecha: sumarDias(HOY, -30) });
  const deA = await crearHistorial(clinicaA, mascota, {
    fecha: sumarDias(HOY, -20),
    diagnostico: "Otitis",
    notas_internas: "Cliente difícil (A)",
  });
  const deB = await crearHistorial(clinicaB, mascota, {
    fecha: sumarDias(HOY, -30),
    diagnostico: "Dermatitis",
    notas_internas: "Nota privada (B)",
  });
  return {
    cliente,
    mascota,
    clinicaA,
    clinicaB,
    vet,
    citaA,
    deA,
    deB,
    tokenCliente: await tokenDe(cliente),
    tokenA: await tokenDe(clinicaA.propietario),
    tokenB: await tokenDe(clinicaB.propietario),
    tokenVet: await tokenDe(usuarioVet),
  };
};

const panel = (ctx, negocio, token) => api(token).get(`/negocios/${negocio.id_negocio}/mascotas/${ctx.mascota.id_mascota}/historial`);

describe("historial médico: lectura", () => {
  it("el dueño ve todos los registros, de todos los negocios, sin notas internas", async () => {
    const ctx = await contexto();
    const res = await api(ctx.tokenCliente).get(`/mascotas/${ctx.mascota.id_mascota}/historial`);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data.map((r) => r.diagnostico)).toEqual(["Otitis", "Dermatitis"]);
    expect(res.body.data[0].negocio).toEqual({ id_negocio: ctx.clinicaA.id_negocio, nombre: "Clínica A" });
    expect(JSON.stringify(res.body)).not.toContain("Cliente difícil");
    expect(JSON.stringify(res.body)).not.toContain("Nota privada");
    expect(res.body.data[0]).not.toHaveProperty("es_propio");
  });

  it("un negocio con cita ve todo si se comparte, pero solo sus propias notas internas", async () => {
    const ctx = await contexto();
    const res = await panel(ctx, ctx.clinicaA, ctx.tokenA);

    expect(res.status).toBe(200);
    const [propio, ajeno] = res.body.data;
    expect(propio).toMatchObject({ id_historial: ctx.deA.id_historial, es_propio: true, notas_internas: "Cliente difícil (A)" });
    expect(ajeno).toMatchObject({ id_historial: ctx.deB.id_historial, es_propio: false, diagnostico: "Dermatitis" });
    expect(ajeno).not.toHaveProperty("notas_internas");
  });

  it("con compartir_historial en false, cada negocio ve solo lo que creó", async () => {
    const ctx = await contexto();
    const patch = await api(ctx.tokenCliente).patch(`/mascotas/${ctx.mascota.id_mascota}`).send({ compartir_historial: false });
    expect(patch.body.data.compartir_historial).toBe(false);

    const deA = await panel(ctx, ctx.clinicaA, ctx.tokenA);
    expect(deA.body.data.map((r) => r.id_historial)).toEqual([ctx.deA.id_historial]);
    const deB = await panel(ctx, ctx.clinicaB, ctx.tokenB);
    expect(deB.body.data.map((r) => r.id_historial)).toEqual([ctx.deB.id_historial]);

    const dueno = await api(ctx.tokenCliente).get(`/mascotas/${ctx.mascota.id_mascota}/historial`);
    expect(dueno.body.meta.total).toBe(2);
  });

  it("un negocio sin cita válida -> 403 (canceladas y reprogramadas no cuentan); con una pendiente sí", async () => {
    const ctx = await contexto();
    const otro = await crearNegocio();
    const token = await tokenDe(otro.propietario);
    expect((await panel(ctx, otro, token)).status).toBe(403);

    await crearCita(otro, { cliente: ctx.cliente, mascota: ctx.mascota, estado: "cancelada" });
    await crearCita(otro, { cliente: ctx.cliente, mascota: ctx.mascota, estado: "reprogramada", hora_inicio: "10:00:00", hora_fin: "10:30:00" });
    const res = await panel(ctx, otro, token);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Esta mascota no tiene citas con el negocio");

    await crearCita(otro, { cliente: ctx.cliente, mascota: ctx.mascota, estado: "pendiente", hora_inicio: "11:00:00", hora_fin: "11:30:00" });
    expect((await panel(ctx, otro, token)).status).toBe(200);
  });

  it("mascota eliminada por el dueño -> 404 también para el negocio; sin historial_medico.ver -> 403", async () => {
    const ctx = await contexto();
    const usuario = await crearUsuario();
    await crearEmpleado(ctx.clinicaA, { usuario, rol: "Recepcionista" });
    expect((await panel(ctx, ctx.clinicaA, await tokenDe(usuario))).status).toBe(403);

    await pool.query("UPDATE mascotas SET activo = FALSE WHERE id_mascota = ?", [ctx.mascota.id_mascota]);
    expect((await panel(ctx, ctx.clinicaA, ctx.tokenA)).status).toBe(404);
    expect((await api(ctx.tokenCliente).get(`/mascotas/${ctx.mascota.id_mascota}/historial`)).status).toBe(404);
  });

  it("filtra por tipo y fechas; otro usuario -> 403", async () => {
    const ctx = await contexto();
    await crearHistorial(ctx.clinicaA, ctx.mascota, { tipo: "desparasitacion", fecha: sumarDias(HOY, -5) });
    const base = `/mascotas/${ctx.mascota.id_mascota}/historial`;
    const porTipo = await api(ctx.tokenCliente).get(`${base}?tipo=desparasitacion`);
    expect(porTipo.body.data.map((r) => r.tipo)).toEqual(["desparasitacion"]);
    const porFecha = await api(ctx.tokenCliente).get(`${base}?desde=${sumarDias(HOY, -25)}`);
    expect(porFecha.body.meta.total).toBe(2);
    expect((await api(await tokenDe(await crearUsuario())).get(base)).status).toBe(403);
  });
});

describe("POST /negocios/:id_negocio/historial", () => {
  const crear = (ctx, body, token = ctx.tokenVet, negocio = ctx.clinicaA) =>
    api(token).post(`/negocios/${negocio.id_negocio}/historial`).send({ id_mascota: ctx.mascota.id_mascota, ...body });

  it("crea el registro con fecha de hoy y el perfil de empleado de quien registra; actualiza el peso", async () => {
    const ctx = await contexto();
    const res = await crear(ctx, {
      tipo: "consulta_general",
      id_cita: ctx.citaA.id_cita,
      diagnostico: "Sano",
      peso_registro: 12.4,
      temperatura: 38.5,
      proximo_control: sumarDias(HOY, 180),
      archivos: ["https://cdn.petcat.test/rx.pdf"],
      notas_internas: "Revisar en 6 meses",
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      fecha: HOY,
      id_cita: ctx.citaA.id_cita,
      peso_registro: 12.4,
      temperatura: 38.5,
      archivos: ["https://cdn.petcat.test/rx.pdf"],
      empleado: { id_empleado: ctx.vet.id_empleado, nombre: "Vera" },
      negocio: { id_negocio: ctx.clinicaA.id_negocio },
      es_propio: true,
      notas_internas: "Revisar en 6 meses",
    });
    const [[mascota]] = await pool.query("SELECT peso FROM mascotas WHERE id_mascota = ?", [ctx.mascota.id_mascota]);
    expect(Number(mascota.peso)).toBe(12.4);
  });

  it("un peso con fecha anterior al último registrado no cambia el peso de la mascota", async () => {
    const ctx = await contexto();
    await crear(ctx, { tipo: "consulta_general", peso_registro: 12 });
    await crear(ctx, { tipo: "consulta_general", peso_registro: 9, fecha: sumarDias(HOY, -60) });
    const [[mascota]] = await pool.query("SELECT peso FROM mascotas WHERE id_mascota = ?", [ctx.mascota.id_mascota]);
    expect(Number(mascota.peso)).toBe(12);
  });

  it("valida la cita, las fechas y que los archivos sean https -> 422", async () => {
    const ctx = await contexto();
    const citaDeB = await crearCita(ctx.clinicaB, { cliente: ctx.cliente, mascota: ctx.mascota });
    const cancelada = await crearCita(ctx.clinicaA, { cliente: ctx.cliente, mascota: ctx.mascota, estado: "cancelada" });
    for (const id_cita of [citaDeB.id_cita, cancelada.id_cita]) {
      const res = await crear(ctx, { tipo: "consulta_general", id_cita });
      expect(res.status).toBe(422);
      expect(res.body.errors).toHaveProperty("id_cita");
    }
    const http = await crear(ctx, { tipo: "consulta_general", archivos: ["http://inseguro.test/a.pdf"] });
    expect(http.body.errors).toEqual({ "archivos.0": "Debe ser una URL https" });
    const futura = await crear(ctx, { tipo: "consulta_general", fecha: sumarDias(HOY, 1) });
    expect(futura.body.errors).toEqual({ fecha: "No puede ser una fecha futura" });
    const control = await crear(ctx, { tipo: "consulta_general", fecha: sumarDias(HOY, -2), proximo_control: sumarDias(HOY, -3) });
    expect(control.body.errors).toEqual({ proximo_control: "No puede ser anterior a la fecha del registro" });
  });

  it("sin cita válida -> 403; sin historial_medico.crear -> 403", async () => {
    const ctx = await contexto();
    const otro = await crearNegocio();
    expect((await crear(ctx, { tipo: "consulta_general" }, await tokenDe(otro.propietario), otro)).status).toBe(403);
    const usuario = await crearUsuario();
    await crearEmpleado(ctx.clinicaA, { usuario, rol: "Recepcionista" });
    expect((await crear(ctx, { tipo: "consulta_general" }, await tokenDe(usuario))).status).toBe(403);
  });
});

describe("PATCH /historial/:id_historial", () => {
  it("solo lo edita el negocio que lo creó", async () => {
    const ctx = await contexto();
    const res = await api(ctx.tokenVet).patch(`/historial/${ctx.deA.id_historial}`).send({ diagnostico: "Otitis externa", notas_internas: null });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ diagnostico: "Otitis externa", notas_internas: null });

    const ajeno = await api(ctx.tokenB).patch(`/historial/${ctx.deA.id_historial}`).send({ diagnostico: "Otra cosa" });
    expect(ajeno.status).toBe(403);
    expect((await api(ctx.tokenCliente).patch(`/historial/${ctx.deA.id_historial}`).send({ diagnostico: "X" })).status).toBe(403);
    expect((await api(ctx.tokenA).patch("/historial/999999999").send({ diagnostico: "X" })).status).toBe(404);
  });

  it("valida proximo_control contra la fecha actual del registro; body vacío -> 422", async () => {
    const ctx = await contexto();
    const res = await api(ctx.tokenA)
      .patch(`/historial/${ctx.deA.id_historial}`)
      .send({ proximo_control: sumarDias(HOY, -25) });
    expect(res.status).toBe(422);
    expect((await api(ctx.tokenA).patch(`/historial/${ctx.deA.id_historial}`).send({})).status).toBe(422);
  });
});
