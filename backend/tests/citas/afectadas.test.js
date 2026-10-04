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

const proximo = (dia) => {
  const fecha = new Date();
  do fecha.setDate(fecha.getDate() + 1);
  while (fecha.getDay() !== dia);
  return hoyISO(fecha);
};
const LUNES = proximo(1);
const SEMANA = [1, 2, 3, 4, 5, 6].map((dia_semana) => ({ dia_semana, hora_apertura: "08:00", hora_cierre: "18:00" }));

const contexto = async () => {
  const negocio = await crearNegocio();
  const sucursal = await crearSucursal(negocio);
  await crearHorarios(sucursal, SEMANA.map((h) => [h.dia_semana, h.hora_apertura, h.hora_cierre]));
  const ana = await crearEmpleado(negocio, { nombre: "Ana" });
  const luis = await crearEmpleado(negocio, { nombre: "Luis" });
  const servicio = await crearServicio(negocio);
  await asignarEmpleados(servicio, [ana, luis]);
  const cliente = await crearUsuario();
  return { negocio, sucursal, ana, luis, servicio, cliente, token: await tokenDe(negocio.propietario) };
};

const cita = (ctx, overrides = {}) =>
  crearCita(ctx.negocio, {
    cliente: ctx.cliente,
    servicio: ctx.servicio,
    id_sucursal: ctx.sucursal.id_sucursal,
    id_empleado: ctx.ana.id_empleado,
    fecha: LUNES,
    hora_inicio: "09:00:00",
    hora_fin: "09:30:00",
    estado: "confirmada",
    ...overrides,
  });

describe("PUT /sucursales/:id_sucursal/horarios con citas_afectadas", () => {
  it("cerrar los lunes deja fuera las citas futuras de ese día (no las canceladas); el cambio se guarda", async () => {
    const ctx = await contexto();
    const afectada = await cita(ctx);
    await cita(ctx, { estado: "cancelada", hora_inicio: "10:00:00", hora_fin: "10:30:00" });

    const res = await api(ctx.token)
      .put(`/sucursales/${ctx.sucursal.id_sucursal}/horarios`)
      .send({ horarios: SEMANA.filter((h) => h.dia_semana !== 1) });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Horarios actualizados. 1 cita queda fuera del horario de la sede");
    expect(res.body.data.horarios).toHaveLength(5);
    expect(res.body.data.citas_afectadas.map((c) => c.id_cita)).toEqual([afectada.id_cita]);
  });

  it("un horario que sigue cubriendo la cita no la afecta", async () => {
    const ctx = await contexto();
    await cita(ctx);
    const res = await api(ctx.token)
      .put(`/sucursales/${ctx.sucursal.id_sucursal}/horarios`)
      .send({ horarios: [{ dia_semana: 1, hora_apertura: "09:00", hora_cierre: "12:00" }] });
    expect(res.body.data.citas_afectadas).toEqual([]);
  });
});

describe("DELETE /empleados/:id_empleado con citas_afectadas", () => {
  it("desactivar devuelve todas sus citas futuras pendientes o confirmadas", async () => {
    const ctx = await contexto();
    const a = await cita(ctx);
    const b = await cita(ctx, { estado: "pendiente", hora_inicio: "11:00:00", hora_fin: "11:30:00" });
    await cita(ctx, { estado: "completada", fecha: "2026-01-05" });

    const res = await api(ctx.token).delete(`/empleados/${ctx.ana.id_empleado}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Empleado desactivado. 2 citas quedan fuera de la disponibilidad del empleado");
    expect(res.body.data.empleado).toMatchObject({ id_empleado: ctx.ana.id_empleado, activo: false });
    expect(res.body.data.citas_afectadas.map((c) => c.id_cita)).toEqual([a.id_cita, b.id_cita]);
  });

  it("una reserva que esperaba mientras se desactivaba al empleado no lo asigna (409 si era el único)", async () => {
    const ctx = await contexto();
    await pool.query("DELETE FROM empleado_servicios WHERE id_servicio = ? AND id_empleado = ?", [
      ctx.servicio.id_servicio,
      ctx.luis.id_empleado,
    ]);
    const mascota = await crearMascota(ctx.cliente);
    const tokenCliente = await tokenDe(ctx.cliente);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("SELECT id_empleado FROM empleados WHERE id_empleado = ? FOR UPDATE", [ctx.ana.id_empleado]);
      await conn.query("UPDATE empleados SET activo = FALSE WHERE id_empleado = ?", [ctx.ana.id_empleado]);

      const pendiente = api(tokenCliente)
        .post("/citas")
        .send({
          id_servicio: ctx.servicio.id_servicio,
          id_sucursal: ctx.sucursal.id_sucursal,
          fecha: LUNES,
          hora_inicio: "09:00",
          id_mascota: mascota.id_mascota,
        })
        .then((r) => r);
      await new Promise((resolve) => setTimeout(resolve, 400));
      await conn.commit();

      const res = await pendiente;
      expect(res.status).toBe(409);
    } finally {
      conn.release();
    }
  });
});
