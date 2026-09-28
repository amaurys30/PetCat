import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
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

/**
 * Programación de los recordatorios de una cita confirmada (migración 014,
 * sp_programar_recordatorios_cita): el del día anterior a las 19:00 y el de 2 horas
 * antes, solo si su hora aún no pasó. Los envía el job de la 2.4.
 */

const dosDigitos = (n) => String(n).padStart(2, "0");
const sumarDias = (fechaISO, dias) => {
  const fecha = new Date(`${fechaISO}T12:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  return hoyISO(fecha);
};
/** Lunes a más de una semana: el recordatorio del día anterior siempre es futuro. */
const LUNES_LEJANO = (() => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 8);
  while (fecha.getDay() !== 1) fecha.setDate(fecha.getDate() + 1);
  return hoyISO(fecha);
})();

/** { fecha, hora_inicio, hora_fin } de una cita que empieza dentro de `minutos`. */
const dentroDe = (minutos) => {
  const inicio = new Date(Date.now() + minutos * 60000);
  const fin = new Date(inicio.getTime() + 30 * 60000);
  const hora = (d) => `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}:00`;
  return { fecha: hoyISO(inicio), hora_inicio: hora(inicio), hora_fin: hora(fin) };
};

const contexto = async () => {
  const negocio = await crearNegocio();
  const sucursal = await crearSucursal(negocio);
  await crearHorarios(sucursal, [1, 2, 3, 4, 5, 6].map((d) => [d, "08:00", "18:00"]));
  const empleado = await crearEmpleado(negocio);
  const servicio = await crearServicio(negocio, { duracion_minutos: 30 });
  await asignarEmpleados(servicio, [empleado]);
  const cliente = await crearUsuario();
  const mascota = await crearMascota(cliente);
  return { negocio, sucursal, servicio, cliente, mascota, tokenPropietario: await tokenDe(negocio.propietario) };
};

const pendiente = (ctx, overrides = {}) =>
  crearCita(ctx.negocio, {
    cliente: ctx.cliente,
    mascota: ctx.mascota,
    servicio: ctx.servicio,
    id_sucursal: ctx.sucursal.id_sucursal,
    fecha: LUNES_LEJANO,
    estado: "pendiente",
    ...overrides,
  });

const recordatoriosDe = async (id_cita) => {
  const [rows] = await pool.query(
    "SELECT tipo, canal, estado, fecha_programada, id_usuario, id_mascota FROM recordatorios WHERE id_cita = ? ORDER BY fecha_programada",
    [id_cita]
  );
  return rows;
};

describe("recordatorios de una cita confirmada", () => {
  it("al confirmar: el del día anterior a las 19:00 y el de 2 horas antes, por push", async () => {
    const ctx = await contexto();
    const cita = await pendiente(ctx, { hora_inicio: "09:00:00", hora_fin: "09:30:00" });
    const res = await api(ctx.tokenPropietario).patch(`/citas/${cita.id_cita}/estado`).send({ estado: "confirmada" });
    expect(res.status).toBe(200);

    expect(await recordatoriosDe(cita.id_cita)).toEqual([
      {
        tipo: "cita_dia_anterior",
        canal: "push",
        estado: "pendiente",
        fecha_programada: `${sumarDias(LUNES_LEJANO, -1)} 19:00:00`,
        id_usuario: ctx.cliente.id_usuario,
        id_mascota: ctx.mascota.id_mascota,
      },
      {
        tipo: "cita_recordatorio",
        canal: "push",
        estado: "pendiente",
        fecha_programada: `${LUNES_LEJANO} 07:00:00`,
        id_usuario: ctx.cliente.id_usuario,
        id_mascota: ctx.mascota.id_mascota,
      },
    ]);
  });

  it("una cita que nace confirmada desde el panel recibe los mismos dos", async () => {
    const ctx = await contexto();
    const res = await api(ctx.tokenPropietario)
      .post(`/negocios/${ctx.negocio.id_negocio}/citas`)
      .send({
        id_servicio: ctx.servicio.id_servicio,
        id_sucursal: ctx.sucursal.id_sucursal,
        fecha: LUNES_LEJANO,
        hora_inicio: "15:00",
        id_mascota: ctx.mascota.id_mascota,
        id_usuario: ctx.cliente.id_usuario,
        origen: "telefono",
      });
    expect(res.status).toBe(201);

    const recordatorios = await recordatoriosDe(res.body.data.id_cita);
    expect(recordatorios.map((r) => [r.tipo, r.fecha_programada])).toEqual([
      ["cita_dia_anterior", `${sumarDias(LUNES_LEJANO, -1)} 19:00:00`],
      ["cita_recordatorio", `${LUNES_LEJANO} 13:00:00`],
    ]);
  });

  it("si las 19:00 del día anterior ya pasaron (p. ej. se agenda esa noche para mañana), solo el de 2 horas antes", async () => {
    const ctx = await contexto();
    const cita = await pendiente(ctx, dentroDe(3 * 60));
    await pool.query("UPDATE citas SET estado = 'confirmada' WHERE id_cita = ?", [cita.id_cita]);
    expect((await recordatoriosDe(cita.id_cita)).map((r) => r.tipo)).toEqual(["cita_recordatorio"]);
  });

  it("si la cita empieza en menos de 2 horas, ninguno", async () => {
    const ctx = await contexto();
    const cita = await pendiente(ctx, dentroDe(60));
    await pool.query("UPDATE citas SET estado = 'confirmada' WHERE id_cita = ?", [cita.id_cita]);
    expect(await recordatoriosDe(cita.id_cita)).toEqual([]);
  });

  it("programarlos otra vez no los duplica (uno de cada tipo por cita)", async () => {
    const ctx = await contexto();
    const cita = await pendiente(ctx);
    await pool.query("UPDATE citas SET estado = 'confirmada' WHERE id_cita = ?", [cita.id_cita]);
    await pool.query("CALL sp_programar_recordatorios_cita(?, ?, ?, ?, ?)", [
      cita.id_cita,
      cita.id_usuario,
      cita.id_mascota,
      cita.fecha,
      cita.hora_inicio,
    ]);
    expect((await recordatoriosDe(cita.id_cita)).map((r) => r.tipo)).toEqual(["cita_dia_anterior", "cita_recordatorio"]);
  });
});
