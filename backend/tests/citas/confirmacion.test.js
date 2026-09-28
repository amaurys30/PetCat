import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { aDatetimeSQL, hoyISO } from "../../src/shared/utils/fechas.js";
import { calcularPlazoConfirmacion } from "../../src/modules/citas/cita.confirmacion.js";
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

/** Plazo de confirmación, opción del negocio y cancelaciones del sistema (2.5, migración 017). */

const a = (fecha, hora) => new Date(`${fecha}T${hora}:00`);
const SILENCIO = { inicio: 21 * 60, fin: 7 * 60 };
const plazo = (creacion, inicio, silencio = SILENCIO) =>
  aDatetimeSQL(calcularPlazoConfirmacion({ creacion, inicio, plazoH: 24, antesInicioMin: 60, silencio }));

describe("calcularPlazoConfirmacion", () => {
  it("lo que ocurra primero: 24 horas después de reservar o 60 minutos antes del inicio", () => {
    expect(plazo(a("2031-03-10", "10:00"), a("2031-03-12", "10:00"))).toBe("2031-03-11 10:00:00");
    expect(plazo(a("2031-03-10", "10:00"), a("2031-03-10", "15:00"))).toBe("2031-03-10 14:00:00");
  });

  it("si cae de madrugada se corre a las 08:00 (fin del silencio + 60), sin pasar de 30 minutos antes del inicio", () => {
    // 24 h después: 22:30 del día siguiente -> 08:00 del otro.
    expect(plazo(a("2031-03-10", "22:30"), a("2031-03-12", "10:00"))).toBe("2031-03-12 08:00:00");
    // Reservada a las 20:00 para las 08:00: 60 min antes serían las 07:00 -> 08:00, pero el tope es 07:30.
    expect(plazo(a("2031-03-10", "20:00"), a("2031-03-11", "08:00"))).toBe("2031-03-11 07:30:00");
    // Reservada de madrugada para más tarde ese día: el plazo (10:00) ya es de día.
    expect(plazo(a("2031-03-10", "06:00"), a("2031-03-10", "11:00"))).toBe("2031-03-10 10:00:00");
  });

  it("es monótona alrededor del fin del silencio: 06:59 y 07:15 terminan a las 08:00, 08:05 se queda", () => {
    // Plazo base = reserva + 24 h (la cita es a las 12:00, así que el tope no influye).
    const conBase = (base) => plazo(new Date(base.getTime() - 24 * 3_600_000), a("2031-03-11", "12:00"));
    expect(conBase(a("2031-03-11", "06:59"))).toBe("2031-03-11 08:00:00");
    expect(conBase(a("2031-03-11", "07:15"))).toBe("2031-03-11 08:00:00");
    expect(conBase(a("2031-03-11", "08:05"))).toBe("2031-03-11 08:05:00");
  });

  it("sin horario de silencio no se corre; nunca antes de la reserva", () => {
    expect(plazo(a("2031-03-10", "20:00"), a("2031-03-11", "08:00"), { inicio: 0, fin: 0 })).toBe("2031-03-11 07:00:00");
    expect(plazo(a("2031-03-10", "10:00"), a("2031-03-10", "10:30"))).toBe("2031-03-10 10:00:00");
  });
});

/** Negocio abierto de lunes a sábado con un servicio de 30 min y un cliente con su perro. */
const contexto = async () => {
  const negocio = await crearNegocio();
  const sucursal = await crearSucursal(negocio);
  await crearHorarios(sucursal, [1, 2, 3, 4, 5, 6].map((d) => [d, "08:00", "18:00"]));
  const empleado = await crearEmpleado(negocio);
  const servicio = await crearServicio(negocio, { duracion_minutos: 30 });
  await asignarEmpleados(servicio, [empleado]);
  const cliente = await crearUsuario();
  const mascota = await crearMascota(cliente);
  return { negocio, sucursal, servicio, cliente, mascota, tokenCliente: await tokenDe(cliente), tokenPropietario: await tokenDe(negocio.propietario) };
};
const lunesLejano = () => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 8);
  while (fecha.getDay() !== 1) fecha.setDate(fecha.getDate() + 1);
  return hoyISO(fecha);
};

describe("plazo en la reserva", () => {
  it("la cita pendiente de la app trae confirmar_antes_de; confirmada, ya no", async () => {
    const ctx = await contexto();
    const fecha = lunesLejano();
    const antes = Date.now();
    const res = await api(ctx.tokenCliente).post("/citas").send({
      id_servicio: ctx.servicio.id_servicio,
      id_sucursal: ctx.sucursal.id_sucursal,
      fecha,
      hora_inicio: "10:00",
      id_mascota: ctx.mascota.id_mascota,
    });
    expect(res.status).toBe(201);
    // 24 horas después de reservar (la cita es en más de una semana), con margen por la hora del test.
    const plazoMs = new Date(res.body.data.confirmar_antes_de.replace(" ", "T")).getTime();
    expect(plazoMs).toBeGreaterThanOrEqual(antes + 24 * 3_600_000 - 1000);
    expect(plazoMs).toBeLessThanOrEqual(Date.now() + 25 * 3_600_000);

    const confirmada = await api(ctx.tokenPropietario).patch(`/citas/${res.body.data.id_cita}/estado`).send({ estado: "confirmada" });
    expect(confirmada.body.data.confirmar_antes_de).toBeNull();
  });
});

describe("negocios.confirmacion_automatica", () => {
  it("desactivada por defecto, se edita con configuracion.editar y sale en el perfil público", async () => {
    const negocio = await crearNegocio();
    const token = await tokenDe(negocio.propietario);
    expect((await api().get(`/negocios/${negocio.id_negocio}`)).body.data.confirmacion_automatica).toBe(false);

    const res = await api(token).patch(`/negocios/${negocio.id_negocio}`).send({ confirmacion_automatica: true });
    expect(res.status).toBe(200);
    expect(res.body.data.confirmacion_automatica).toBe(true);
    expect((await api().get(`/negocios/${negocio.id_negocio}`)).body.data.confirmacion_automatica).toBe(true);

    const invalido = await api(token).patch(`/negocios/${negocio.id_negocio}`).send({ confirmacion_automatica: "si" });
    expect(invalido.status).toBe(422);
  });
});

describe("cancelación del sistema", () => {
  it("se ve como sistema en la cita y su historial, y no cuenta en historial_cumplimiento", async () => {
    const ctx = await contexto();
    const cita = await crearCita(ctx.negocio, {
      cliente: ctx.cliente,
      mascota: ctx.mascota,
      servicio: ctx.servicio,
      id_sucursal: ctx.sucursal.id_sucursal,
      fecha: lunesLejano(),
      estado: "cancelada",
      cancelada_por: "sistema",
      // Aunque quedara marcada como tardía, una cancelación del sistema no cuenta contra el cliente.
      cancelacion_tardia: true,
      motivo_cancelacion: "El negocio no confirmó la cita a tiempo",
    });
    await pool.query(
      "INSERT INTO historial_citas (id_cita, campo_modificado, valor_anterior, valor_nuevo, motivo) VALUES (?, 'estado', 'pendiente', 'cancelada', ?)",
      [cita.id_cita, "El negocio no confirmó la cita a tiempo"]
    );

    const panel = await api(ctx.tokenPropietario).get(`/citas/${cita.id_cita}`);
    expect(panel.body.data.cancelacion).toMatchObject({ por: "sistema", motivo: "El negocio no confirmó la cita a tiempo" });
    expect(panel.body.data.cliente.historial_cumplimiento).toEqual({ completadas: 0, inasistencias: 0, cancelaciones_tardias: 0 });

    const historial = await api(ctx.tokenCliente).get(`/citas/${cita.id_cita}/historial`);
    expect(historial.body.data.at(-1)).toMatchObject({ valor_nuevo: "cancelada", realizado_por: "sistema" });
    const historialPanel = await api(ctx.tokenPropietario).get(`/citas/${cita.id_cita}/historial`);
    expect(historialPanel.body.data.at(-1)).toMatchObject({ realizado_por: "sistema", usuario: null, empleado: null });
  });
});
