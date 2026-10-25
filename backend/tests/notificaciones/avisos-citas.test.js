import { beforeEach, describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { pushSender } from "../../src/shared/utils/push.js";
import { clearOutbox, outbox } from "../../src/shared/utils/mailer.js";
import { api } from "../helpers/api.js";
import {
  asignarEmpleados,
  crearCita,
  crearDispositivo,
  crearEmpleado,
  crearHorarios,
  crearMascota,
  crearNegocio,
  crearRol,
  crearServicio,
  crearSucursal,
  crearUsuario,
  sinSilencio,
  tokenDe,
} from "../helpers/factories.js";

beforeEach(async () => {
  pushSender.reiniciar();
  clearOutbox();
  await sinSilencio();
});

const proximo = (dia, desde = new Date()) => {
  const fecha = new Date(desde);
  do fecha.setDate(fecha.getDate() + 1);
  while (fecha.getDay() !== dia);
  return hoyISO(fecha);
};
const LUNES = proximo(1);
const MARTES = proximo(2);

/**
 * Negocio con sede de lunes a sábado 08–18 y un servicio de 30 min con dos profesionales
 * sin cuenta. Personal con cuenta: recepcionista (citas.ver), administradora
 * (configuracion.editar) y un auxiliar sin citas.ver. Cliente con su perro.
 */
const contexto = async (plan = "Pro") => {
  const negocio = await crearNegocio(null, { plan, nombre: "Clínica Patitas" });
  const sucursal = await crearSucursal(negocio, { nombre: "Sede Centro", direccion: "Calle 23 # 18-45" });
  await crearHorarios(sucursal, [1, 2, 3, 4, 5, 6].map((d) => [d, "08:00", "18:00"]));
  const profesionales = [await crearEmpleado(negocio), await crearEmpleado(negocio)];
  const servicio = await crearServicio(negocio, { nombre: "Consulta general", duracion_minutos: 30 });
  await asignarEmpleados(servicio, profesionales);

  const recepcion = await crearUsuario();
  await crearEmpleado(negocio, { usuario: recepcion, rol: "Recepcionista" });
  const admin = await crearUsuario();
  await crearEmpleado(negocio, { usuario: admin, rol: "Administrador" });
  const auxiliar = await crearUsuario();
  await crearEmpleado(negocio, { usuario: auxiliar, rol: (await crearRol(negocio, { servicios: ["ver"] })).id_rol });

  const cliente = await crearUsuario({ nombre: "Laura" });
  const mascota = await crearMascota(cliente, { nombre: "Max" });
  return {
    negocio,
    sucursal,
    servicio,
    cliente,
    mascota,
    recepcion,
    admin,
    auxiliar,
    tokenCliente: await tokenDe(cliente),
    tokenPropietario: await tokenDe(negocio.propietario),
    tokenRecepcion: await tokenDe(recepcion),
  };
};

const reserva = (ctx, extra = {}) => ({
  id_servicio: ctx.servicio.id_servicio,
  id_sucursal: ctx.sucursal.id_sucursal,
  fecha: LUNES,
  hora_inicio: "09:00",
  id_mascota: ctx.mascota.id_mascota,
  ...extra,
});

/** Tipos de notificación que recibió cada usuario, en orden. */
const tiposDe = async (usuario) => {
  const [rows] = await pool.query("SELECT tipo FROM notificaciones WHERE id_usuario = ? ORDER BY id_notificacion", [usuario.id_usuario]);
  return rows.map((r) => r.tipo);
};
const ultimaDe = async (usuario) => {
  const [[row]] = await pool.query("SELECT * FROM notificaciones WHERE id_usuario = ? ORDER BY id_notificacion DESC LIMIT 1", [
    usuario.id_usuario,
  ]);
  return row;
};

const reservarApp = async (ctx, extra) => {
  const res = await api(ctx.tokenCliente).post("/citas").send(reserva(ctx, extra));
  expect(res.status).toBe(201);
  return res.body.data;
};

describe("avisos de citas", () => {
  it("cita_nueva desde la app: al personal con citas.ver y al propietario; correo solo al propietario sin dispositivo", async () => {
    const ctx = await contexto();
    const dispositivo = await crearDispositivo(ctx.recepcion);
    const cita = await reservarApp(ctx);

    expect(await tiposDe(ctx.negocio.propietario)).toEqual(["cita_nueva"]);
    expect(await tiposDe(ctx.recepcion)).toEqual(["cita_nueva"]);
    expect(await tiposDe(ctx.admin)).toEqual(["cita_nueva"]); // el Administrador también tiene citas.ver
    expect(await tiposDe(ctx.auxiliar)).toEqual([]);
    expect(await tiposDe(ctx.cliente)).toEqual([]);

    const notificacion = await ultimaDe(ctx.recepcion);
    expect(notificacion.mensaje).toContain("Laura Prueba reservó Consulta general para Max");
    // mysql2 devuelve la columna JSON ya como objeto.
    expect(notificacion.datos_extra_json.enlace).toEqual({
      tipo: "cita_nueva",
      id_cita: cita.id_cita,
      id_negocio: ctx.negocio.id_negocio,
      fecha: cita.fecha,
    });

    // Push a la recepcionista (tiene dispositivo), sin nombres.
    const push = pushSender.enviados.find((m) => m.to === dispositivo.token_expo);
    expect(push.title).toBe("Nueva cita por confirmar");
    expect(push.body).not.toMatch(/Laura|Max/);

    // Correo: solo al propietario (sin dispositivo). La recepcionista y la administradora no reciben correo.
    expect(outbox.map((c) => c.to)).toEqual([ctx.negocio.propietario.email]);
  });

  it("cita_agendada desde el panel: al dueño (correo si no tiene la app), no a quien la agendó", async () => {
    const ctx = await contexto();
    const res = await api(ctx.tokenRecepcion)
      .post(`/negocios/${ctx.negocio.id_negocio}/citas`)
      .send({ ...reserva(ctx), id_usuario: ctx.cliente.id_usuario, origen: "telefono" });
    expect(res.status).toBe(201);

    expect(await tiposDe(ctx.cliente)).toEqual(["cita_agendada"]);
    expect(await tiposDe(ctx.recepcion)).toEqual([]);
    expect(await tiposDe(ctx.negocio.propietario)).toEqual([]);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: ctx.cliente.email, subject: "Tu cita en Clínica Patitas" });
    expect(outbox[0].text).toContain("Dónde: Clínica Patitas — Sede Centro, Calle 23 # 18-45.");
  });

  it("confirmar una cita pendiente avisa al dueño", async () => {
    const ctx = await contexto();
    const cita = await reservarApp(ctx);
    const res = await api(ctx.tokenRecepcion).patch(`/citas/${cita.id_cita}/estado`).send({ estado: "confirmada" });
    expect(res.status).toBe(200);
    expect(await tiposDe(ctx.cliente)).toEqual(["cita_confirmada"]);
    expect((await ultimaDe(ctx.cliente)).titulo).toBe("Cita confirmada");
  });

  it("cancelación: si cancela el dueño se avisa al negocio; si cancela el negocio, al dueño (el motivo solo en la app)", async () => {
    const ctx = await contexto();
    const primera = await reservarApp(ctx);
    expect((await api(ctx.tokenCliente).post(`/citas/${primera.id_cita}/cancelar`).send({})).status).toBe(200);
    expect(await tiposDe(ctx.recepcion)).toEqual(["cita_nueva", "cita_cancelada"]);
    expect(await tiposDe(ctx.cliente)).toEqual([]);

    const segunda = await reservarApp(ctx, { hora_inicio: "10:00" });
    await crearDispositivo(ctx.cliente);
    pushSender.reiniciar();
    const res = await api(ctx.tokenRecepcion)
      .post(`/citas/${segunda.id_cita}/cancelar`)
      .send({ motivo: "La veterinaria está incapacitada" });
    expect(res.status).toBe(200);
    expect(await tiposDe(ctx.cliente)).toEqual(["cita_cancelada"]);
    expect((await ultimaDe(ctx.cliente)).mensaje).toContain("Motivo: La veterinaria está incapacitada");
    expect(pushSender.enviados).toHaveLength(1);
    expect(pushSender.enviados[0].body).not.toContain("incapacitada");
    // La recepcionista canceló: no se avisa a sí misma.
    expect(await tiposDe(ctx.recepcion)).toEqual(["cita_nueva", "cita_cancelada", "cita_nueva"]);
  });

  it("reprogramación: la del dueño avisa al negocio y la del negocio al dueño, con la fecha anterior", async () => {
    const ctx = await contexto();
    const cita = await reservarApp(ctx);
    const res = await api(ctx.tokenCliente).post(`/citas/${cita.id_cita}/reprogramar`).send({ fecha: MARTES, hora_inicio: "11:00" });
    expect(res.status).toBe(201);
    expect((await tiposDe(ctx.recepcion)).at(-1)).toBe("cita_reprogramada");
    expect((await ultimaDe(ctx.recepcion)).mensaje).toMatch(/del lunes, .+ a las 9:00 a\. m\. al martes, .+ a las 11:00 a\. m\./);

    const porNegocio = await api(ctx.tokenRecepcion)
      .post(`/citas/${res.body.data.id_cita}/reprogramar`)
      .send({ fecha: MARTES, hora_inicio: "15:00", motivo: "Cambio de turno" });
    expect(porNegocio.status).toBe(201);
    expect(await tiposDe(ctx.cliente)).toEqual(["cita_reprogramada"]);
  });

  it("si la operación falla no se notifica nada", async () => {
    const ctx = await contexto();
    await reservarApp(ctx);
    const antes = (await tiposDe(ctx.recepcion)).length;
    // La misma mascota a la misma hora: 409.
    const res = await api(ctx.tokenCliente).post("/citas").send(reserva(ctx));
    expect(res.status).toBe(409);
    expect(await tiposDe(ctx.recepcion)).toHaveLength(antes);
  });
});

describe("avisos del límite del plan", () => {
  /** `n` citas completadas del negocio en `fecha` (cuentan para el límite del mes). */
  const llenarMes = async (ctx, n, fecha = LUNES) => {
    for (let i = 0; i < n; i++) {
      await crearCita(ctx.negocio, { cliente: ctx.cliente, mascota: ctx.mascota, servicio: ctx.servicio, fecha, estado: "completada", hora_inicio: "07:00:00", hora_fin: "07:30:00" });
    }
  };

  it("la reserva que cruza el 80 % avisa una vez al mes al propietario y a quien tiene configuracion.editar", async () => {
    const ctx = await contexto("Gratuito");
    await llenarMes(ctx, 23); // la 24 de 30 cruza el 80 %
    const cita = await reservarApp(ctx);

    expect(await tiposDe(ctx.negocio.propietario)).toEqual(["cita_nueva", "plan_limite_80"]);
    expect(await tiposDe(ctx.admin)).toEqual(["cita_nueva", "plan_limite_80"]);
    expect(await tiposDe(ctx.recepcion)).toEqual(["cita_nueva"]); // sin configuracion.editar
    expect((await ultimaDe(ctx.admin)).mensaje).toContain("lleva 24 de las 30 citas");

    // Cancelar y volver a cruzar el umbral en el mismo mes no repite el aviso.
    await api(ctx.tokenCliente).post(`/citas/${cita.id_cita}/cancelar`).send({});
    await reservarApp(ctx, { hora_inicio: "10:00" });
    expect((await tiposDe(ctx.admin)).filter((t) => t === "plan_limite_80")).toHaveLength(1);
  });

  it("una reserva rechazada por el límite avisa al negocio, como máximo una vez al día", async () => {
    const ctx = await contexto("Gratuito");
    await llenarMes(ctx, 30);
    expect((await api(ctx.tokenCliente).post("/citas").send(reserva(ctx))).status).toBe(409);
    expect((await api(ctx.tokenCliente).post("/citas").send(reserva(ctx, { hora_inicio: "11:00" }))).status).toBe(409);

    expect(await tiposDe(ctx.negocio.propietario)).toEqual(["plan_limite_alcanzado"]);
    expect(await tiposDe(ctx.admin)).toEqual(["plan_limite_alcanzado"]);
    expect(await tiposDe(ctx.recepcion)).toEqual([]);
    const aviso = await ultimaDe(ctx.negocio.propietario);
    expect(aviso.mensaje).toContain("alcanzó las 30 citas");
    expect(aviso.mensaje).toContain("del plan Gratuito");
  });
});
