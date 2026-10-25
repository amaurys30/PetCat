import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import { io as cliente } from "socket.io-client";
import app from "../../src/app.js";
import { hoyISO } from "../../src/shared/utils/fechas.js";
import { cerrarSocket, iniciarSocket } from "../../src/realtime/socket.js";
import { api } from "../helpers/api.js";
import {
  asignarEmpleados,
  crearCita,
  crearEmpleado,
  crearHorarios,
  crearMascota,
  crearNegocio,
  crearRol,
  crearServicio,
  crearSucursal,
  crearUsuario,
  tokenDe,
} from "../helpers/factories.js";

/** Evento agenda_actualizada (P4.4): llega a quien tiene citas.ver del negocio y al propietario. */

let server;
let url;
const abiertos = [];

beforeAll(async () => {
  server = http.createServer(app);
  iniciarSocket(server);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
  for (const s of abiertos) s.disconnect();
  await cerrarSocket();
  await new Promise((resolve) => server.close(resolve));
});

const conectar = async (usuario) => {
  const token = await tokenDe(usuario);
  return new Promise((resolve, reject) => {
    const socket = cliente(url, { path: "/socket.io", auth: { token }, transports: ["websocket"], reconnection: false });
    abiertos.push(socket);
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
};

/** Próximo agenda_actualizada (o null si no llega en `ms`). */
const siguiente = (socket, ms = 1500) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    socket.once("agenda_actualizada", (datos) => {
      clearTimeout(timer);
      resolve(datos);
    });
  });

const lunesLejano = () => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 8);
  while (fecha.getDay() !== 1) fecha.setDate(fecha.getDate() + 1);
  return hoyISO(fecha);
};

/**
 * Negocio con: un recepcionista (citas.ver), un empleado con un rol sin citas.ver,
 * un empleado inactivo con citas.ver, el cliente y el propietario de otro negocio.
 */
const contexto = async () => {
  const negocio = await crearNegocio();
  const sucursal = await crearSucursal(negocio);
  await crearHorarios(sucursal, [1, 2, 3, 4, 5, 6].map((d) => [d, "08:00", "18:00"]));
  const empleado = await crearEmpleado(negocio);
  const servicio = await crearServicio(negocio, { duracion_minutos: 30 });
  await asignarEmpleados(servicio, [empleado]);

  const recepcion = await crearUsuario();
  await crearEmpleado(negocio, { rol: "Recepcionista", usuario: recepcion });
  const sinVer = await crearUsuario();
  await crearEmpleado(negocio, { rol: (await crearRol(negocio, { inventario: ["ver"] })).id_rol, usuario: sinVer });
  const inactivo = await crearUsuario();
  await crearEmpleado(negocio, { rol: "Recepcionista", usuario: inactivo, activo: false });
  const otroNegocio = await crearNegocio();

  const duenoMascota = await crearUsuario();
  const mascota = await crearMascota(duenoMascota);
  return { negocio, sucursal, empleado, servicio, recepcion, sinVer, inactivo, otroNegocio, duenoMascota, mascota };
};

/** Conecta a todos y devuelve las promesas del próximo evento de cada uno. */
const escuchar = async (ctx) => {
  const sockets = {
    propietario: await conectar(ctx.negocio.propietario),
    recepcion: await conectar(ctx.recepcion),
    sinVer: await conectar(ctx.sinVer),
    inactivo: await conectar(ctx.inactivo),
    otroNegocio: await conectar(ctx.otroNegocio.propietario),
    cliente: await conectar(ctx.duenoMascota),
  };
  const ms = (k) => (["propietario", "recepcion"].includes(k) ? 1500 : 400);
  return Object.fromEntries(Object.entries(sockets).map(([k, s]) => [k, siguiente(s, ms(k))]));
};

const resolver = async (promesas) => Object.fromEntries(await Promise.all(Object.entries(promesas).map(async ([k, p]) => [k, await p])));

const esperarSoloElPersonal = (r) => {
  expect(r.sinVer).toBeNull();
  expect(r.inactivo).toBeNull();
  expect(r.otroNegocio).toBeNull();
  expect(r.cliente).toBeNull();
  expect(r.recepcion).toEqual(r.propietario);
};

describe("agenda_actualizada", () => {
  it("reserva desde la app: llega con el resumen de la cita al personal con citas.ver, no a los demás", async () => {
    const ctx = await contexto();
    const promesas = await escuchar(ctx);
    const fecha = lunesLejano();
    const res = await api(await tokenDe(ctx.duenoMascota)).post("/citas").send({
      id_servicio: ctx.servicio.id_servicio,
      id_sucursal: ctx.sucursal.id_sucursal,
      fecha,
      hora_inicio: "10:00",
      id_mascota: ctx.mascota.id_mascota,
    });
    expect(res.status).toBe(201);

    const r = await resolver(promesas);
    expect(r.propietario).toEqual({
      id_negocio: ctx.negocio.id_negocio,
      accion: "reserva_app",
      id_cita: res.body.data.id_cita,
      fechas: [fecha],
      por: ctx.duenoMascota.id_usuario,
      cita: {
        mascota: ctx.mascota.nombre,
        servicio: ctx.servicio.nombre,
        fecha,
        hora_inicio: "10:00",
        estado: "pendiente",
      },
    });
    esperarSoloElPersonal(r);
  });

  it("confirmar desde el panel llega también a quien hizo el cambio, sin resumen", async () => {
    const ctx = await contexto();
    const cita = await crearCita(ctx.negocio, { servicio: ctx.servicio, id_sucursal: ctx.sucursal.id_sucursal, id_empleado: ctx.empleado.id_empleado });
    const promesas = await escuchar(ctx);
    const res = await api(await tokenDe(ctx.recepcion)).patch(`/citas/${cita.id_cita}/estado`).send({ estado: "confirmada" });
    expect(res.status).toBe(200);

    const r = await resolver(promesas);
    expect(r.propietario).toEqual({
      id_negocio: ctx.negocio.id_negocio,
      accion: "estado",
      id_cita: cita.id_cita,
      estado: "confirmada",
      fechas: [cita.fecha],
      por: ctx.recepcion.id_usuario,
    });
    esperarSoloElPersonal(r);
  });

  it("un bloqueo del empleado avisa un cambio de disponibilidad", async () => {
    const ctx = await contexto();
    const promesas = await escuchar(ctx);
    const res = await api(await tokenDe(ctx.negocio.propietario))
      .post(`/empleados/${ctx.empleado.id_empleado}/disponibilidad`)
      .send({ tipo: "bloqueo", fecha_especifica: lunesLejano(), hora_inicio: "10:00", hora_fin: "11:00" });
    expect(res.status).toBe(201);

    const r = await resolver(promesas);
    expect(r.propietario).toMatchObject({
      id_negocio: ctx.negocio.id_negocio,
      accion: "disponibilidad",
      id_empleado: ctx.empleado.id_empleado,
      por: ctx.negocio.propietario.id_usuario,
    });
    esperarSoloElPersonal(r);
  });

  it("sin citas.ver_todas, cada profesional recibe solo los cambios de sus citas y de su disponibilidad", async () => {
    const ctx = await contexto();
    const usuarioVet = await crearUsuario();
    const vet = await crearEmpleado(ctx.negocio, { usuario: usuarioVet });
    const usuarioOtro = await crearUsuario();
    await crearEmpleado(ctx.negocio, { usuario: usuarioOtro });
    const cita = await crearCita(ctx.negocio, { servicio: ctx.servicio, id_sucursal: ctx.sucursal.id_sucursal, id_empleado: vet.id_empleado });
    const socketVet = await conectar(usuarioVet);
    const socketOtro = await conectar(usuarioOtro);

    let deVet = siguiente(socketVet);
    let deOtro = siguiente(socketOtro, 400);
    const res = await api(await tokenDe(ctx.recepcion)).patch(`/citas/${cita.id_cita}/estado`).send({ estado: "confirmada" });
    expect(res.status).toBe(200);
    expect(await deVet).toMatchObject({ accion: "estado", id_cita: cita.id_cita });
    expect(await deOtro).toBeNull();

    deVet = siguiente(socketVet);
    deOtro = siguiente(socketOtro, 400);
    const bloqueo = await api(await tokenDe(ctx.negocio.propietario))
      .post(`/empleados/${vet.id_empleado}/disponibilidad`)
      .send({ tipo: "bloqueo", fecha_especifica: lunesLejano(), hora_inicio: "10:00", hora_fin: "11:00" });
    expect(bloqueo.status).toBe(201);
    expect(await deVet).toMatchObject({ accion: "disponibilidad", id_empleado: vet.id_empleado });
    expect(await deOtro).toBeNull();
  });
});
