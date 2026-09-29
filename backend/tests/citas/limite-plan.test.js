import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { errorLimiteCitas } from "../../src/modules/suscripciones/suscripcion.service.js";
import { api } from "../helpers/api.js";
import {
  asignarEmpleados,
  crearCita,
  crearEmpleado,
  crearHorarios,
  crearMascota,
  crearNegocio,
  crearServicio,
  crearSucursal,
  crearUsuario,
  tokenDe,
} from "../helpers/factories.js";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const proximoLunes = (desde = new Date()) => {
  const fecha = new Date(desde);
  do fecha.setDate(fecha.getDate() + 1);
  while (fecha.getDay() !== 1);
  return fecha;
};
const LUNES_DATE = proximoLunes();
const LUNES = hoyISO(LUNES_DATE);
// Primer lunes del mes siguiente al de LUNES (dentro del horizonte de 60 días).
const LUNES_OTRO_MES = hoyISO(
  proximoLunes(new Date(LUNES_DATE.getFullYear(), LUNES_DATE.getMonth() + 1, 1, 12) - 86_400_000)
);
const nombreMes = (fecha) => `${MESES[Number(fecha.slice(5, 7)) - 1]} de ${fecha.slice(0, 4)}`;

/** Negocio (Gratuito por defecto) con sucursal de lunes a sábado 08–18, un servicio y dos veterinarios. */
const contexto = async (plan = "Gratuito") => {
  const negocio = await crearNegocio(null, { plan });
  const sucursal = await crearSucursal(negocio);
  await crearHorarios(sucursal, [1, 2, 3, 4, 5, 6].map((d) => [d, "08:00", "18:00"]));
  const ana = await crearEmpleado(negocio);
  const luis = await crearEmpleado(negocio);
  const servicio = await crearServicio(negocio, { duracion_minutos: 30 });
  await asignarEmpleados(servicio, [ana, luis]);
  const cliente = await crearUsuario();
  const mascota = await crearMascota(cliente);
  return {
    negocio,
    sucursal,
    ana,
    servicio,
    cliente,
    mascota,
    tokenCliente: await tokenDe(cliente),
    tokenPropietario: await tokenDe(negocio.propietario),
  };
};

/**
 * `n` citas completadas del negocio en `fecha`, sin empleado (no ocupan la agenda
 * pero cuentan para el límite del mes). `estado` permite crear las que no cuentan.
 */
const llenarMes = async (ctx, n, fecha = LUNES, estado = "completada") => {
  if (n === 0) return;
  const filas = Array.from({ length: n }, () => [
    ctx.negocio.id_negocio, ctx.sucursal.id_sucursal, ctx.cliente.id_usuario, ctx.mascota.id_mascota,
    ctx.servicio.id_servicio, fecha, "07:00:00", "07:30:00", estado,
  ]);
  await pool.query(
    `INSERT INTO citas (id_negocio, id_sucursal, id_usuario, id_mascota, id_servicio, fecha, hora_inicio, hora_fin, estado)
     VALUES ?`,
    [filas]
  );
};

const reserva = (ctx, extra = {}) => ({
  id_servicio: ctx.servicio.id_servicio,
  id_sucursal: ctx.sucursal.id_sucursal,
  fecha: LUNES,
  hora_inicio: "09:00",
  id_mascota: ctx.mascota.id_mascota,
  ...extra,
});

const query = (ctx, fecha = LUNES) =>
  new URLSearchParams({ id_servicio: ctx.servicio.id_servicio, id_sucursal: ctx.sucursal.id_sucursal, fecha });

describe("límite de citas del mes en la app", () => {
  it("la cita 30 del Gratuito se reserva; la 31 da el 409 neutro y los horarios libres quedan vacíos", async () => {
    const ctx = await contexto();
    await llenarMes(ctx, 29);

    expect((await api(ctx.tokenCliente).post("/citas").send(reserva(ctx))).status).toBe(201);
    const res = await api(ctx.tokenCliente).post("/citas").send(reserva(ctx, { hora_inicio: "11:00" }));
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: "El horario ya no está disponible: elige otro" });

    const libres = await api().get(`/citas/horarios-libres?${query(ctx)}`);
    expect(libres.status).toBe(200);
    expect(libres.body.data).toMatchObject({ horarios: [], motivo_sin_horarios: "No hay horarios disponibles para esa fecha" });
  });

  it("las canceladas y reprogramadas no cuentan, y otro mes tiene su propio límite", async () => {
    const ctx = await contexto();
    await llenarMes(ctx, 29);
    await llenarMes(ctx, 1, LUNES, "cancelada");
    await llenarMes(ctx, 1, LUNES, "reprogramada");
    expect((await api(ctx.tokenCliente).post("/citas").send(reserva(ctx))).status).toBe(201);

    // El mes de LUNES está lleno; el siguiente no.
    expect((await api(ctx.tokenCliente).post("/citas").send(reserva(ctx, { hora_inicio: "10:00" }))).status).toBe(409);
    const otroMes = await api(ctx.tokenCliente).post("/citas").send(reserva(ctx, { fecha: LUNES_OTRO_MES }));
    expect(otroMes.status).toBe(201);
  });

  it("Pro: citas ilimitadas", async () => {
    const ctx = await contexto("Pro");
    await llenarMes(ctx, 35);
    expect((await api(ctx.tokenCliente).post("/citas").send(reserva(ctx))).status).toBe(201);
  });

  it("tres reservas simultáneas con 29 citas: solo una entra", async () => {
    const ctx = await contexto();
    await llenarMes(ctx, 29);
    const clientes = await Promise.all([1, 2, 3].map(() => crearUsuario()));
    const pedidos = await Promise.all(
      clientes.map(async (cliente, i) => {
        const mascota = await crearMascota(cliente);
        const body = reserva(ctx, { id_mascota: mascota.id_mascota, hora_inicio: ["09:00", "10:00", "11:00"][i] });
        return { token: await tokenDe(cliente), body };
      })
    );
    const respuestas = await Promise.all(pedidos.map(({ token, body }) => api(token).post("/citas").send(body)));
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409, 409]);
  });
});

describe("límite de citas del mes en el panel", () => {
  it("403 con el motivo del plan al agendar, y los horarios libres del panel lo explican", async () => {
    const ctx = await contexto();
    await llenarMes(ctx, 30);
    const motivo = `El negocio alcanzó las 30 citas de su plan Gratuito en ${nombreMes(LUNES)}`;

    const res = await api(ctx.tokenPropietario)
      .post(`/negocios/${ctx.negocio.id_negocio}/citas`)
      .send({ ...reserva(ctx), id_usuario: ctx.cliente.id_usuario, origen: "presencial" });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      success: false,
      message: `${motivo}. Mejora tu plan para continuar.`,
      errors: { plan: "Límite de citas del mes alcanzado (30 de 30)" },
    });

    const libres = await api(ctx.tokenPropietario).get(`/negocios/${ctx.negocio.id_negocio}/citas/horarios-libres?${query(ctx)}`);
    expect(libres.body.data).toMatchObject({ horarios: [], motivo_sin_horarios: motivo });
  });
});

describe("límite de citas del mes al reprogramar", () => {
  const citaOriginal = (ctx, fecha = LUNES) =>
    crearCita(ctx.negocio, {
      cliente: ctx.cliente,
      mascota: ctx.mascota,
      servicio: ctx.servicio,
      id_sucursal: ctx.sucursal.id_sucursal,
      id_empleado: ctx.ana.id_empleado,
      fecha,
      hora_inicio: "09:00:00",
      hora_fin: "09:30:00",
      estado: "confirmada",
    });

  it("dentro del mismo mes no consume cupo aunque el mes esté lleno", async () => {
    const ctx = await contexto();
    await llenarMes(ctx, 29);
    const original = await citaOriginal(ctx); // la 30 del mes

    const res = await api(ctx.tokenCliente)
      .post(`/citas/${original.id_cita}/reprogramar`)
      .send({ fecha: LUNES, hora_inicio: "10:00" });
    expect(res.status).toBe(201);
  });

  it("a un mes lleno: el dueño recibe el 409 neutro y el negocio 403; la original no cambia", async () => {
    const ctx = await contexto();
    await llenarMes(ctx, 30, LUNES_OTRO_MES);
    const original = await citaOriginal(ctx);
    const body = { fecha: LUNES_OTRO_MES, hora_inicio: "10:00" };

    const dueno = await api(ctx.tokenCliente).post(`/citas/${original.id_cita}/reprogramar`).send(body);
    expect(dueno.status).toBe(409);
    expect(dueno.body.message).toBe("El horario ya no está disponible: elige otro");

    const negocio = await api(ctx.tokenPropietario).post(`/citas/${original.id_cita}/reprogramar`).send(body);
    expect(negocio.status).toBe(403);
    expect(negocio.body.errors).toEqual({ plan: "Límite de citas del mes alcanzado (30 de 30)" });

    const [[{ estado }]] = await pool.query("SELECT estado FROM citas WHERE id_cita = ?", [original.id_cita]);
    expect(estado).toBe("confirmada");
  });
});

describe("errorLimiteCitas", () => {
  it("guarda en el error los datos del límite para avisar al negocio", () => {
    const limite = { plan: { nombre: "Gratuito" }, maximo: 30, usadas: 30 };
    const app = errorLimiteCitas("app", limite, "2026-10-05", 7);
    expect(app.status).toBe(409);
    expect(app.limitePlan).toEqual({ id_negocio: 7, recurso: "citas_mes", mes: "2026-10", maximo: 30, usadas: 30, plan: "Gratuito" });
    expect(errorLimiteCitas("panel", limite, "2026-10-05", 7).status).toBe(403);
  });
});
