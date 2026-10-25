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
  crearRol,
  crearServicio,
  crearSucursal,
  crearUsuario,
  sinSilencio,
  tokenDe,
} from "../helpers/factories.js";

/**
 * citas.ver_todas (migración 026): sin ella, el personal con citas.ver solo ve y gestiona sus
 * propias citas. El Veterinario del sistema no la tiene; el Administrador, la Recepcionista y
 * el propietario ven todo. La ficha de la mascota sigue mostrando todas sus citas.
 */

const lunesLejano = () => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 8);
  while (fecha.getDay() !== 1) fecha.setDate(fecha.getDate() + 1);
  return hoyISO(fecha);
};
const LUNES = lunesLejano();

/** Ana y Luis (Veterinario, con cuenta) atienden la consulta; Rosa es Recepcionista. */
const contexto = async () => {
  const negocio = await crearNegocio();
  const sucursal = await crearSucursal(negocio);
  await crearHorarios(sucursal, [1, 2, 3, 4, 5, 6].map((d) => [d, "08:00", "18:00"]));
  const usuarioAna = await crearUsuario({ nombre: "Ana" });
  const ana = await crearEmpleado(negocio, { usuario: usuarioAna });
  const usuarioLuis = await crearUsuario({ nombre: "Luis" });
  const luis = await crearEmpleado(negocio, { usuario: usuarioLuis });
  const usuarioRosa = await crearUsuario({ nombre: "Rosa" });
  await crearEmpleado(negocio, { usuario: usuarioRosa, rol: "Recepcionista" });
  const servicio = await crearServicio(negocio, { duracion_minutos: 30 });
  await asignarEmpleados(servicio, [ana, luis]);
  const cliente = await crearUsuario();
  const mascota = await crearMascota(cliente);
  const cita = (empleado, overrides = {}) =>
    crearCita(negocio, {
      cliente,
      mascota,
      servicio,
      id_sucursal: sucursal.id_sucursal,
      id_empleado: empleado.id_empleado,
      fecha: LUNES,
      estado: "confirmada",
      notas_internas: "Nota del negocio",
      ...overrides,
    });
  return {
    negocio,
    sucursal,
    servicio,
    ana,
    luis,
    usuarioAna,
    usuarioLuis,
    usuarioRosa,
    cliente,
    mascota,
    cita,
    tokenAna: await tokenDe(usuarioAna),
    tokenRosa: await tokenDe(usuarioRosa),
    tokenPropietario: await tokenDe(negocio.propietario),
  };
};

/** Dos citas el lunes: la de Ana a las 09:00 y la de Luis a las 10:00. */
const conCitas = async () => {
  const ctx = await contexto();
  const deAna = await ctx.cita(ctx.ana);
  const deLuis = await ctx.cita(ctx.luis, { hora_inicio: "10:00:00", hora_fin: "10:30:00" });
  return { ...ctx, deAna, deLuis };
};

const ids = (res) => res.body.data.map((c) => c.id_cita).sort((a, b) => a - b);
const agenda = (ctx, token, extra = "") =>
  api(token).get(`/negocios/${ctx.negocio.id_negocio}/citas?desde=${LUNES}&hasta=${LUNES}${extra}`);

describe("agenda y atención sin citas.ver_todas", () => {
  it("el Veterinario ve solo sus citas; pedir las de otro da 403; Recepcionista y propietario ven todas", async () => {
    const ctx = await conCitas();
    expect(ids(await agenda(ctx, ctx.tokenAna))).toEqual([ctx.deAna.id_cita]);
    const ajena = await agenda(ctx, ctx.tokenAna, `&id_empleado=${ctx.luis.id_empleado}`);
    expect(ajena.status).toBe(403);
    expect(ajena.body.message).toBe("Solo puedes ver tus propias citas");
    expect(ids(await agenda(ctx, ctx.tokenAna, `&id_empleado=${ctx.ana.id_empleado}`))).toEqual([ctx.deAna.id_cita]);

    const todas = [ctx.deAna.id_cita, ctx.deLuis.id_cita].sort((a, b) => a - b);
    expect(ids(await agenda(ctx, ctx.tokenRosa))).toEqual(todas);
    expect(ids(await agenda(ctx, ctx.tokenPropietario))).toEqual(todas);
  });

  it("un rol propio con citas.ver_todas ve todas; sin ella, solo las propias", async () => {
    const ctx = await conCitas();
    const conTodas = await crearUsuario();
    await crearEmpleado(ctx.negocio, {
      usuario: conTodas,
      rol: (await crearRol(ctx.negocio, { citas: ["ver", "ver_todas"] })).id_rol,
    });
    expect(ids(await agenda(ctx, await tokenDe(conTodas)))).toHaveLength(2);

    // Sin ver_todas y sin citas propias: la agenda vacía.
    const sinTodas = await crearUsuario();
    await crearEmpleado(ctx.negocio, { usuario: sinTodas, rol: (await crearRol(ctx.negocio, { citas: ["ver"] })).id_rol });
    expect(ids(await agenda(ctx, await tokenDe(sinTodas)))).toEqual([]);
  });

  it("Por confirmar y Fuera de disponibilidad: solo las propias", async () => {
    const ctx = await contexto();
    const deAna = await ctx.cita(ctx.ana, { estado: "pendiente" });
    await ctx.cita(ctx.luis, { estado: "pendiente", hora_inicio: "10:00:00", hora_fin: "10:30:00" });
    const atencion = (token, extra = "") =>
      api(token).get(`/negocios/${ctx.negocio.id_negocio}/citas/atencion${extra}`);

    const deVet = await atencion(ctx.tokenAna);
    expect(deVet.status).toBe(200);
    expect(deVet.body.data.por_confirmar.map((c) => c.id_cita)).toEqual([deAna.id_cita]);
    expect(deVet.body.data.fuera_de_disponibilidad.every((c) => c.empleado.id_empleado === ctx.ana.id_empleado)).toBe(true);
    expect((await atencion(ctx.tokenAna, `?id_empleado=${ctx.luis.id_empleado}`)).status).toBe(403);
    expect((await atencion(ctx.tokenRosa)).body.data.por_confirmar).toHaveLength(2);
  });
});

describe("una cita de otro profesional", () => {
  it("detalle, historial y cambios dan 403; los de la propia, no", async () => {
    const ctx = await conCitas();
    const vet = api(ctx.tokenAna);
    const id = ctx.deLuis.id_cita;

    const detalle = await vet.get(`/citas/${id}`);
    expect(detalle.status).toBe(403);
    expect(detalle.body.message).toBe("Esta cita es de otro profesional");
    expect((await vet.get(`/citas/${id}/historial`)).status).toBe(403);
    expect((await vet.get(`/citas/${id}/profesionales-libres`)).status).toBe(403);
    expect((await vet.patch(`/citas/${id}`).send({ prioridad: "alta" })).status).toBe(403);
    expect((await vet.patch(`/citas/${id}/estado`).send({ estado: "en_curso" })).status).toBe(403);
    expect((await vet.post(`/citas/${id}/cancelar`).send({ motivo: "No" })).status).toBe(403);
    expect((await vet.post(`/citas/${id}/reprogramar`).send({ fecha: LUNES, hora_inicio: "11:00" })).status).toBe(403);
    const [[sinCambios]] = await pool.query("SELECT estado, prioridad FROM citas WHERE id_cita = ?", [id]);
    expect(sinCambios).toEqual({ estado: "confirmada", prioridad: "normal" });

    expect((await vet.get(`/citas/${ctx.deAna.id_cita}`)).status).toBe(200);
    expect((await vet.patch(`/citas/${ctx.deAna.id_cita}`).send({ prioridad: "alta" })).status).toBe(200);
    // La Recepcionista sí abre la de Luis.
    expect((await api(ctx.tokenRosa).get(`/citas/${id}`)).status).toBe(200);
  });

  it("una cita sin profesional tampoco es propia", async () => {
    const ctx = await contexto();
    const sinProfesional = await ctx.cita({ id_empleado: null });
    expect((await api(ctx.tokenAna).get(`/citas/${sinProfesional.id_cita}`)).status).toBe(403);
  });

  it("si además es la dueña de la cita, la ve como dueña (sin notas internas)", async () => {
    const ctx = await contexto();
    const suMascota = await crearMascota(ctx.usuarioAna);
    const cita = await crearCita(ctx.negocio, {
      cliente: ctx.usuarioAna,
      mascota: suMascota,
      servicio: ctx.servicio,
      id_sucursal: ctx.sucursal.id_sucursal,
      id_empleado: ctx.luis.id_empleado,
      notas_internas: "Nota del negocio",
    });
    const res = await api(ctx.tokenAna).get(`/citas/${cita.id_cita}`);
    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty("notas_internas");
  });

  it("no reasigna su cita a otro profesional ni la reprograma a nombre de otro", async () => {
    const ctx = await conCitas();
    const vet = api(ctx.tokenAna);
    const id = ctx.deAna.id_cita;
    const reasignar = await vet.patch(`/citas/${id}`).send({ id_empleado: ctx.luis.id_empleado });
    expect(reasignar.status).toBe(403);
    const reprogramar = await vet
      .post(`/citas/${id}/reprogramar`)
      .send({ fecha: LUNES, hora_inicio: "11:00", id_empleado: ctx.luis.id_empleado });
    expect(reprogramar.status).toBe(403);

    // Sin id_empleado, la nueva queda a su nombre.
    const propia = await vet.post(`/citas/${id}/reprogramar`).send({ fecha: LUNES, hora_inicio: "11:00" });
    expect(propia.status).toBe(201);
    expect(propia.body.data.empleado.id_empleado).toBe(ctx.ana.id_empleado);
  });
});

describe("agendar desde el panel sin citas.ver_todas", () => {
  const body = (ctx, extra = {}) => ({
    id_usuario: ctx.cliente.id_usuario,
    id_mascota: ctx.mascota.id_mascota,
    id_servicio: ctx.servicio.id_servicio,
    id_sucursal: ctx.sucursal.id_sucursal,
    fecha: LUNES,
    hora_inicio: "09:00",
    ...extra,
  });

  it("solo para sí mismo: con otro profesional 403; sin indicarlo, la cita queda a su nombre", async () => {
    const ctx = await contexto();
    const url = `/negocios/${ctx.negocio.id_negocio}/citas`;
    const ajena = await api(ctx.tokenAna).post(url).send(body(ctx, { id_empleado: ctx.luis.id_empleado }));
    expect(ajena.status).toBe(403);
    expect(ajena.body.message).toBe("Solo puedes agendar citas a tu nombre");

    // Aunque Luis tenga menos carga, la cita es de Ana.
    await ctx.cita(ctx.ana, { hora_inicio: "08:00:00", hora_fin: "08:30:00" });
    const propia = await api(ctx.tokenAna).post(url).send(body(ctx));
    expect(propia.status).toBe(201);
    expect(propia.body.data.empleado.id_empleado).toBe(ctx.ana.id_empleado);

    const deRosa = await api(ctx.tokenRosa).post(url).send(body(ctx, { id_empleado: ctx.luis.id_empleado, hora_inicio: "10:00" }));
    expect(deRosa.status).toBe(201);
    expect(deRosa.body.data.empleado.id_empleado).toBe(ctx.luis.id_empleado);
  });

  it("horarios libres: solo los propios; pedir los de otro da 403", async () => {
    const ctx = await contexto();
    const url = (extra = "") =>
      `/negocios/${ctx.negocio.id_negocio}/citas/horarios-libres?id_servicio=${ctx.servicio.id_servicio}&id_sucursal=${ctx.sucursal.id_sucursal}&fecha=${LUNES}${extra}`;
    const propios = await api(ctx.tokenAna).get(url());
    expect(propios.status).toBe(200);
    expect(propios.body.data.horarios.length).toBeGreaterThan(0);
    expect(propios.body.data.horarios.every((h) => h.empleados.every((e) => e.id_empleado === ctx.ana.id_empleado))).toBe(true);
    expect((await api(ctx.tokenAna).get(url(`&id_empleado=${ctx.luis.id_empleado}`))).status).toBe(403);

    const deRosa = await api(ctx.tokenRosa).get(url());
    const empleados = new Set(deRosa.body.data.horarios.flatMap((h) => h.empleados.map((e) => e.id_empleado)));
    expect(empleados).toEqual(new Set([ctx.ana.id_empleado, ctx.luis.id_empleado]));
  });
});

describe("ficha de la mascota", () => {
  it("el Veterinario ve todas las citas de la mascota con el negocio (continuidad clínica)", async () => {
    const ctx = await conCitas();
    const res = await api(ctx.tokenAna).get(`/negocios/${ctx.negocio.id_negocio}/mascotas/${ctx.mascota.id_mascota}/citas`);
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([ctx.deAna.id_cita, ctx.deLuis.id_cita].sort((a, b) => a - b));
  });
});

describe("notificaciones de citas", () => {
  const avisos = async (usuario, tipo) => {
    const [rows] = await pool.query("SELECT id_notificacion FROM notificaciones WHERE id_usuario = ? AND tipo = ?", [
      usuario.id_usuario,
      tipo,
    ]);
    return rows.length;
  };

  it("cuando el dueño cancela, avisa al profesional de la cita, a quien ve todas y al propietario", async () => {
    await sinSilencio();
    const ctx = await conCitas();
    const res = await api(await tokenDe(ctx.cliente)).post(`/citas/${ctx.deLuis.id_cita}/cancelar`).send({});
    expect(res.status).toBe(200);

    expect(await avisos(ctx.usuarioLuis, "cita_cancelada")).toBe(1);
    expect(await avisos(ctx.usuarioRosa, "cita_cancelada")).toBe(1);
    expect(await avisos(ctx.negocio.propietario, "cita_cancelada")).toBe(1);
    expect(await avisos(ctx.usuarioAna, "cita_cancelada")).toBe(0);
  });

  it("al reprogramar desde la app a otro profesional, avisa al anterior y al nuevo", async () => {
    await sinSilencio();
    const ctx = await conCitas();
    const res = await api(await tokenDe(ctx.cliente))
      .post(`/citas/${ctx.deLuis.id_cita}/reprogramar`)
      .send({ fecha: LUNES, hora_inicio: "11:00", id_empleado: ctx.ana.id_empleado });
    expect(res.status).toBe(201);
    expect(await avisos(ctx.usuarioLuis, "cita_reprogramada")).toBe(1);
    expect(await avisos(ctx.usuarioAna, "cita_reprogramada")).toBe(1);
  });
});
