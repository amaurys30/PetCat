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
  tokenDe,
} from "../helpers/factories.js";

const dosDigitos = (n) => String(n).padStart(2, "0");
const sumarDias = (fechaISO, dias) => {
  const fecha = new Date(`${fechaISO}T12:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  return hoyISO(fecha);
};
const proximo = (dia) => {
  const fecha = new Date();
  do fecha.setDate(fecha.getDate() + 1);
  while (fecha.getDay() !== dia);
  return hoyISO(fecha);
};
const HOY = hoyISO();
const LUNES = proximo(1);
const MARTES = sumarDias(LUNES, 1);

/** { fecha, hora_inicio, hora_fin } de una cita que empieza dentro de `minutos` (30 min de duración). */
const dentroDe = (minutos) => {
  const inicio = new Date(Date.now() + minutos * 60000);
  const fin = new Date(inicio.getTime() + 30 * 60000);
  const hora = (d) => `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}:00`;
  return { fecha: hoyISO(inicio), hora_inicio: hora(inicio), hora_fin: hora(fin) };
};

/**
 * Negocio con sucursal de lunes a sábado 08–18, un servicio de 30 min que
 * atienden Ana (con cuenta) y Luis, y un cliente con su perro.
 */
const contexto = async ({ servicio: extra = {} } = {}) => {
  const negocio = await crearNegocio();
  const sucursal = await crearSucursal(negocio, { nombre: "Sede Norte" });
  await crearHorarios(sucursal, [1, 2, 3, 4, 5, 6].map((d) => [d, "08:00", "18:00"]));
  const usuarioAna = await crearUsuario();
  const ana = await crearEmpleado(negocio, { usuario: usuarioAna, rol: "Veterinario", nombre: "Ana", apellido: "Alba" });
  const luis = await crearEmpleado(negocio, { nombre: "Luis", apellido: "Zapata" });
  const servicio = await crearServicio(negocio, { precio_base: 60000, ...extra });
  await asignarEmpleados(servicio, [ana, luis]);
  const cliente = await crearUsuario();
  const mascota = await crearMascota(cliente);
  return {
    negocio,
    sucursal,
    ana,
    luis,
    servicio,
    cliente,
    mascota,
    tokenAna: await tokenDe(usuarioAna),
    tokenPropietario: await tokenDe(negocio.propietario),
    tokenCliente: await tokenDe(cliente),
  };
};

const cita = (ctx, overrides = {}) =>
  crearCita(ctx.negocio, {
    cliente: ctx.cliente,
    mascota: ctx.mascota,
    servicio: ctx.servicio,
    id_sucursal: ctx.sucursal.id_sucursal,
    id_empleado: ctx.ana.id_empleado,
    fecha: LUNES,
    hora_inicio: "09:00:00",
    hora_fin: "09:30:00",
    estado: "confirmada",
    precio_estimado: 45000,
    ...overrides,
  });

const filaCita = async (id_cita) => {
  const [[row]] = await pool.query("SELECT * FROM citas WHERE id_cita = ?", [id_cita]);
  return row;
};
const historialDb = async (id_cita) => {
  const [rows] = await pool.query(
    "SELECT campo_modificado, valor_anterior, valor_nuevo, motivo FROM historial_citas WHERE id_cita = ? ORDER BY id_historial",
    [id_cita]
  );
  return rows;
};

const estado = (ctx, c, body, token = ctx.tokenPropietario) => api(token).patch(`/citas/${c.id_cita}/estado`).send(body);
const cancelar = (c, token, body = {}) => api(token).post(`/citas/${c.id_cita}/cancelar`).send(body);
const reprogramar = (c, token, body) => api(token).post(`/citas/${c.id_cita}/reprogramar`).send(body);

describe("PATCH /citas/:id_cita/estado", () => {
  it("pendiente -> confirmada programa el recordatorio y queda en el historial", async () => {
    const ctx = await contexto();
    const c = await cita(ctx, { estado: "pendiente" });
    const res = await estado(ctx, c, { estado: "confirmada", motivo: "Llamamos al cliente" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Cita confirmada");
    expect(res.body.data).toMatchObject({ estado: "confirmada", notas_internas: null });
    // El del día anterior depende de la hora a la que corre la suite (ver recordatorios-programados.test.js).
    const [recordatorios] = await pool.query("SELECT tipo FROM recordatorios WHERE id_cita = ?", [c.id_cita]);
    expect(recordatorios.map((r) => r.tipo)).toContain("cita_recordatorio");
    expect(await historialDb(c.id_cita)).toEqual([
      { campo_modificado: "estado", valor_anterior: "pendiente", valor_nuevo: "confirmada", motivo: "Llamamos al cliente" },
    ]);
  });

  it("transiciones no permitidas y estados finales -> 409", async () => {
    const ctx = await contexto();
    const pendiente = await cita(ctx, { estado: "pendiente" });
    const salto = await estado(ctx, pendiente, { estado: "completada" });
    expect(salto.status).toBe(409);
    expect(salto.body.message).toBe("No se puede pasar de pendiente a completada: desde pendiente solo a confirmada");

    for (const final of ["completada", "cancelada", "reprogramada"]) {
      const c = await cita(ctx, { estado: final });
      const res = await estado(ctx, c, { estado: "en_curso" });
      expect(res.status).toBe(409);
      expect(res.body.message).toBe(`La cita está ${final}: es un estado final`);
    }
  });

  it("en_curso solo desde la fecha de la cita; no_asistio solo desde la hora de inicio", async () => {
    const ctx = await contexto();
    const futura = await cita(ctx);
    expect((await estado(ctx, futura, { estado: "en_curso" })).body.message).toBe(
      "La cita todavía no es hoy: no puede estar en curso"
    );
    expect((await estado(ctx, futura, { estado: "no_asistio" })).body.message).toBe(
      "La inasistencia se marca desde la hora de inicio de la cita"
    );

    const deHoy = await cita(ctx, { fecha: HOY, hora_inicio: "00:00:00", hora_fin: "00:30:00" });
    const res = await estado(ctx, deHoy, { estado: "no_asistio" });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Inasistencia registrada");
  });

  it("no_asistio -> en_curso solo el mismo día (el cliente llegó tarde), con su historial", async () => {
    const ctx = await contexto();
    const hoy = await cita(ctx, { fecha: HOY, hora_inicio: "00:00:00", hora_fin: "00:30:00", estado: "no_asistio" });
    const res = await estado(ctx, hoy, { estado: "en_curso", motivo: "Llegó tarde" });
    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe("en_curso");
    expect(await historialDb(hoy.id_cita)).toEqual([
      { campo_modificado: "estado", valor_anterior: "no_asistio", valor_nuevo: "en_curso", motivo: "Llegó tarde" },
    ]);

    const ayer = await cita(ctx, { fecha: sumarDias(HOY, -1), estado: "no_asistio" });
    const tarde = await estado(ctx, ayer, { estado: "en_curso" });
    expect(tarde.status).toBe(409);
    expect(tarde.body.message).toBe("Una inasistencia solo se corrige a en curso el mismo día de la cita");
  });

  it("completar guarda precio_final (por defecto el estimado) y suma total_citas; precio_final en otro cambio -> 422", async () => {
    const ctx = await contexto();
    const a = await cita(ctx, { estado: "en_curso" });
    const b = await cita(ctx, { estado: "en_curso", hora_inicio: "10:00:00", hora_fin: "10:30:00" });

    const conPrecio = await estado(ctx, a, { estado: "completada", precio_final: 52000 });
    expect(conPrecio.body.data).toMatchObject({ estado: "completada", precio_final: 52000 });
    const porDefecto = await estado(ctx, b, { estado: "completada" });
    expect(porDefecto.body.data.precio_final).toBe(45000);

    const [[negocio]] = await pool.query("SELECT total_citas FROM negocios WHERE id_negocio = ?", [ctx.negocio.id_negocio]);
    expect(negocio.total_citas).toBe(2);

    const c = await cita(ctx, { estado: "pendiente", hora_inicio: "11:00:00", hora_fin: "11:30:00" });
    const res = await estado(ctx, c, { estado: "confirmada", precio_final: 1 });
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({ precio_final: "Solo se envía al completar la cita" });
  });

  it("cancelada no se pone por aquí (422); sin citas.editar -> 403", async () => {
    const ctx = await contexto();
    const c = await cita(ctx);
    expect((await estado(ctx, c, { estado: "cancelada" })).status).toBe(422);

    const usuario = await crearUsuario();
    await crearEmpleado(ctx.negocio, { usuario, rol: (await crearRol(ctx.negocio, { citas: ["ver"] })).id_rol });
    expect((await estado(ctx, c, { estado: "en_curso" }, await tokenDe(usuario))).status).toBe(403);
    expect((await estado(ctx, c, { estado: "en_curso" }, ctx.tokenCliente)).status).toBe(403);
  });
});

describe("POST /citas/:id_cita/cancelar", () => {
  it("el dueño cancela con anticipación: no es tardía; cancela los recordatorios", async () => {
    const ctx = await contexto();
    const c = await cita(ctx);
    await pool.query(
      "INSERT INTO recordatorios (id_usuario, id_cita, tipo, titulo, mensaje, fecha_programada) VALUES (?, ?, 'cita_recordatorio', 't', 'm', NOW())",
      [ctx.cliente.id_usuario, c.id_cita]
    );

    const res = await cancelar(c, ctx.tokenCliente);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Cita cancelada");
    expect(res.body.data).toMatchObject({ estado: "cancelada", cancelacion: { por: "dueno", tardia: false, motivo: null } });
    expect(res.body.data).not.toHaveProperty("notas_internas");
    const [[recordatorio]] = await pool.query("SELECT estado FROM recordatorios WHERE id_cita = ?", [c.id_cita]);
    expect(recordatorio.estado).toBe("cancelado");
    expect((await filaCita(c.id_cita)).fecha_cancelacion).not.toBeNull();
  });

  it("el dueño cancela a menos de 2 horas: se permite y queda como cancelación tardía, visible en el panel", async () => {
    const ctx = await contexto();
    const c = await cita(ctx, dentroDe(60));
    const res = await cancelar(c, ctx.tokenCliente, { motivo: "Se me complicó" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Cita cancelada (cancelación tardía)");
    const panel = await api(ctx.tokenPropietario).get(`/citas/${c.id_cita}`);
    expect(panel.body.data.cancelacion).toMatchObject({ por: "dueno", tardia: true, motivo: "Se me complicó" });
    expect((await historialDb(c.id_cita))[0].motivo).toBe("Cancelación tardía: Se me complicó");
  });

  it("el dueño no puede cancelar una cita que ya empezó; el negocio sí, con motivo obligatorio", async () => {
    const ctx = await contexto();
    const empezada = await cita(ctx, { fecha: HOY, hora_inicio: "00:00:00", hora_fin: "00:30:00" });
    const dueno = await cancelar(empezada, ctx.tokenCliente);
    expect(dueno.status).toBe(409);
    expect(dueno.body.message).toBe("La cita ya empezó: no se puede cancelar");

    const sinMotivo = await cancelar(empezada, ctx.tokenPropietario);
    expect(sinMotivo.status).toBe(422);
    expect(sinMotivo.body.errors).toEqual({ motivo: "Obligatorio al cancelar desde el negocio" });

    const negocio = await cancelar(empezada, ctx.tokenPropietario, { motivo: "El veterinario se enfermó" });
    expect(negocio.status).toBe(200);
    expect(negocio.body.data.cancelacion).toMatchObject({ por: "negocio", tardia: false, motivo: "El veterinario se enfermó" });
  });

  it("solo pendientes o confirmadas; un tercero -> 403", async () => {
    const ctx = await contexto();
    const completada = await cita(ctx, { estado: "completada" });
    const res = await cancelar(completada, ctx.tokenCliente);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Solo se cancelan citas pendientes o confirmadas (esta está completada)");
    expect((await cancelar(await cita(ctx), await tokenDe(await crearUsuario()))).status).toBe(403);
  });
});

describe("POST /citas/:id_cita/reprogramar", () => {
  it("por el dueño: la nueva queda pendiente, conserva precio y origen, y la original queda reprogramada", async () => {
    const ctx = await contexto();
    const original = await cita(ctx, { origen: "telefono", notas_internas: "Alergia a la penicilina" });
    await pool.query(
      "INSERT INTO recordatorios (id_usuario, id_cita, tipo, titulo, mensaje, fecha_programada) VALUES (?, ?, 'cita_recordatorio', 't', 'm', NOW())",
      [ctx.cliente.id_usuario, original.id_cita]
    );

    const res = await reprogramar(original, ctx.tokenCliente, { fecha: MARTES, hora_inicio: "10:00", motivo: "Viaje" });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Cita reprogramada: el negocio debe confirmarla");
    const nueva = res.body.data;
    expect(nueva).toMatchObject({
      fecha: MARTES,
      hora_inicio: "10:00",
      estado: "pendiente",
      precio_estimado: 45000,
      origen: "telefono",
      id_cita_origen: original.id_cita,
    });
    expect(nueva).not.toHaveProperty("notas_internas");
    expect((await filaCita(nueva.id_cita)).notas_internas).toBe("Alergia a la penicilina");
    expect((await filaCita(original.id_cita)).estado).toBe("reprogramada");
    const [[recordatorio]] = await pool.query("SELECT estado FROM recordatorios WHERE id_cita = ?", [original.id_cita]);
    expect(recordatorio.estado).toBe("cancelado");
    expect(await historialDb(original.id_cita)).toEqual([
      {
        campo_modificado: "estado",
        valor_anterior: "confirmada",
        valor_nuevo: "reprogramada",
        motivo: `Reprogramada a la cita #${nueva.id_cita}: Viaje`,
      },
    ]);
    expect((await historialDb(nueva.id_cita))[0]).toMatchObject({
      valor_nuevo: "pendiente",
      motivo: `Reprogramación de la cita #${original.id_cita}`,
    });
  });

  it("por el negocio: la nueva queda confirmada con su recordatorio", async () => {
    const ctx = await contexto();
    const original = await cita(ctx, { estado: "pendiente" });
    const res = await reprogramar(original, ctx.tokenPropietario, {
      fecha: MARTES,
      hora_inicio: "11:00",
      id_empleado: ctx.luis.id_empleado,
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ estado: "confirmada", empleado: { id_empleado: ctx.luis.id_empleado } });
    const [recordatorios] = await pool.query("SELECT tipo FROM recordatorios WHERE id_cita = ? ORDER BY fecha_programada", [
      res.body.data.id_cita,
    ]);
    expect(recordatorios.map((r) => r.tipo)).toEqual(["cita_dia_anterior", "cita_recordatorio"]);
  });

  it("se puede mover dentro del mismo día aunque se cruce con su propio horario y aunque el cupo esté lleno", async () => {
    const ctx = await contexto({ servicio: { max_citas_dia: 1 } });
    const original = await cita(ctx);
    const res = await reprogramar(original, ctx.tokenCliente, { fecha: LUNES, hora_inicio: "09:15", id_empleado: ctx.ana.id_empleado });
    expect(res.status).toBe(201);
    expect(res.body.data.hora_inicio).toBe("09:15");
  });

  it("horario ocupado -> 409 y la original no cambia", async () => {
    const ctx = await contexto();
    const original = await cita(ctx);
    await cita(ctx, { fecha: MARTES, hora_inicio: "10:00:00", hora_fin: "10:30:00", mascota: await crearMascota(ctx.cliente) });
    const res = await reprogramar(original, ctx.tokenCliente, { fecha: MARTES, hora_inicio: "10:00", id_empleado: ctx.ana.id_empleado });
    expect(res.status).toBe(409);
    expect((await filaCita(original.id_cita)).estado).toBe("confirmada");
  });

  it("el dueño a menos de 2 horas -> 409 (el negocio sí puede); una cita final -> 409", async () => {
    const ctx = await contexto();
    const pronto = await cita(ctx, dentroDe(60));
    const dueno = await reprogramar(pronto, ctx.tokenCliente, { fecha: MARTES, hora_inicio: "10:00" });
    expect(dueno.status).toBe(409);
    expect(dueno.body.message).toBe("Solo puedes reprogramar hasta 2 horas antes de la cita: comunícate con el negocio");
    expect((await reprogramar(pronto, ctx.tokenPropietario, { fecha: MARTES, hora_inicio: "10:00" })).status).toBe(201);

    const completada = await cita(ctx, { estado: "completada", hora_inicio: "12:00:00", hora_fin: "12:30:00" });
    expect((await reprogramar(completada, ctx.tokenPropietario, { fecha: MARTES, hora_inicio: "11:00" })).status).toBe(409);
  });

  it("una mascota fallecida no se reprograma -> 409 y la original no cambia", async () => {
    const ctx = await contexto();
    const original = await cita(ctx);
    await pool.query("UPDATE mascotas SET fallecido = TRUE, fecha_fallecimiento = CURDATE() WHERE id_mascota = ?", [
      ctx.mascota.id_mascota,
    ]);
    const res = await reprogramar(original, ctx.tokenPropietario, { fecha: MARTES, hora_inicio: "10:00" });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("La mascota está registrada como fallecida: no puede recibir citas");
    expect((await filaCita(original.id_cita)).estado).toBe("confirmada");
  });

  it("cancelar y reprogramar a la vez: una gana y la otra recibe 409", async () => {
    const ctx = await contexto();
    const c = await cita(ctx);
    const respuestas = await Promise.all([
      cancelar(c, ctx.tokenCliente),
      reprogramar(c, ctx.tokenCliente, { fecha: MARTES, hora_inicio: "10:00" }),
    ]);
    const estados = respuestas.map((r) => r.status).sort();
    expect(estados.filter((s) => s === 409)).toHaveLength(1);
    expect(estados.filter((s) => s === 200 || s === 201)).toHaveLength(1);
    const [nuevas] = await pool.query("SELECT 1 FROM citas WHERE id_cita_origen = ?", [c.id_cita]);
    expect(nuevas.length + ((await filaCita(c.id_cita)).estado === "cancelada" ? 1 : 0)).toBe(1);
  });

  it("un tercero o el personal de otro negocio -> 403", async () => {
    const ctx = await contexto();
    const c = await cita(ctx);
    const otro = await contexto();
    for (const token of [otro.tokenCliente, otro.tokenPropietario]) {
      expect((await reprogramar(c, token, { fecha: MARTES, hora_inicio: "10:00" })).status).toBe(403);
    }
  });
});

describe("PATCH /citas/:id_cita (panel)", () => {
  it("edita notas y prioridad; solo los campos que cambian quedan en el historial", async () => {
    const ctx = await contexto();
    const c = await cita(ctx, { prioridad: "normal" });
    const res = await api(ctx.tokenPropietario)
      .patch(`/citas/${c.id_cita}`)
      .send({ notas_internas: "Traer exámenes", prioridad: "normal" });
    expect(res.status).toBe(200);
    expect(res.body.data.notas_internas).toBe("Traer exámenes");
    expect(await historialDb(c.id_cita)).toEqual([
      { campo_modificado: "notas_internas", valor_anterior: null, valor_nuevo: "Traer exámenes", motivo: null },
    ]);
  });

  it("precio_final solo en curso o completada -> 409 si no", async () => {
    const ctx = await contexto();
    const confirmada = await cita(ctx);
    expect((await api(ctx.tokenPropietario).patch(`/citas/${confirmada.id_cita}`).send({ precio_final: 1000 })).status).toBe(409);
    const completada = await cita(ctx, { estado: "completada", hora_inicio: "10:00:00", hora_fin: "10:30:00" });
    const res = await api(ctx.tokenPropietario).patch(`/citas/${completada.id_cita}`).send({ precio_final: 48000 });
    expect(res.body.data.precio_final).toBe(48000);
  });

  it("reasigna a un empleado libre que atiende el servicio; ocupado -> 409; que no lo atiende -> 422", async () => {
    const ctx = await contexto();
    const c = await cita(ctx);
    const res = await api(ctx.tokenPropietario).patch(`/citas/${c.id_cita}`).send({ id_empleado: ctx.luis.id_empleado });
    expect(res.status).toBe(200);
    expect(res.body.data.empleado).toMatchObject({ id_empleado: ctx.luis.id_empleado, nombre: "Luis" });

    const otra = await cita(ctx, { mascota: await crearMascota(ctx.cliente) });
    const ocupado = await api(ctx.tokenPropietario).patch(`/citas/${otra.id_cita}`).send({ id_empleado: ctx.luis.id_empleado });
    expect(ocupado.status).toBe(409);
    expect(ocupado.body.message).toBe("El empleado no está disponible a esa hora (horario, bloqueos u otra cita)");

    const ajeno = await crearEmpleado(ctx.negocio);
    const noAtiende = await api(ctx.tokenPropietario).patch(`/citas/${otra.id_cita}`).send({ id_empleado: ajeno.id_empleado });
    expect(noAtiende.status).toBe(422);
  });

  it("reasignar a un empleado de vacaciones ese día -> 409; en una cita completada -> 409", async () => {
    const ctx = await contexto();
    const c = await cita(ctx);
    await pool.query("INSERT INTO disponibilidad_empleado (id_empleado, tipo, fecha_especifica) VALUES (?, 'vacacion', ?)", [
      ctx.luis.id_empleado,
      LUNES,
    ]);
    expect((await api(ctx.tokenPropietario).patch(`/citas/${c.id_cita}`).send({ id_empleado: ctx.luis.id_empleado })).status).toBe(409);
    const completada = await cita(ctx, { estado: "completada", hora_inicio: "10:00:00", hora_fin: "10:30:00" });
    const res = await api(ctx.tokenPropietario).patch(`/citas/${completada.id_cita}`).send({ id_empleado: ctx.luis.id_empleado });
    expect(res.body.message).toBe("Solo se reasignan citas pendientes o confirmadas");
  });

  it("el dueño no puede editar -> 403; body vacío -> 422", async () => {
    const ctx = await contexto();
    const c = await cita(ctx);
    expect((await api(ctx.tokenCliente).patch(`/citas/${c.id_cita}`).send({ prioridad: "alta" })).status).toBe(403);
    expect((await api(ctx.tokenPropietario).patch(`/citas/${c.id_cita}`).send({})).status).toBe(422);
  });
});

describe("GET /citas/:id_cita/historial", () => {
  it("el panel ve todo con quién lo hizo; el dueño solo estado y empleado, sin nombres del personal", async () => {
    const ctx = await contexto();
    const c = await cita(ctx, { estado: "pendiente" });
    await estado(ctx, c, { estado: "confirmada" }, ctx.tokenAna);
    await api(ctx.tokenPropietario).patch(`/citas/${c.id_cita}`).send({ notas_internas: "Privado", id_empleado: ctx.luis.id_empleado });

    const panel = await api(ctx.tokenPropietario).get(`/citas/${c.id_cita}/historial`);
    expect(panel.status).toBe(200);
    expect(panel.body.data.map((h) => h.campo)).toEqual(["estado", "notas_internas", "empleado"]);
    expect(panel.body.data[0]).toMatchObject({
      valor_anterior: "pendiente",
      valor_nuevo: "confirmada",
      realizado_por: "negocio",
      empleado: { id_empleado: ctx.ana.id_empleado, nombre: "Ana" },
    });
    expect(panel.body.data[2]).toMatchObject({ valor_anterior: "Ana Alba", valor_nuevo: "Luis Zapata" });

    const dueno = await api(ctx.tokenCliente).get(`/citas/${c.id_cita}/historial`);
    expect(dueno.body.data.map((h) => h.campo)).toEqual(["estado", "empleado"]);
    expect(dueno.body.data[0]).not.toHaveProperty("usuario");
    expect(dueno.body.data[0]).not.toHaveProperty("empleado");
    expect(JSON.stringify(dueno.body)).not.toContain("Privado");
  });

  it("marca realizado_por dueno en lo que hizo el dueño; un tercero -> 403", async () => {
    const ctx = await contexto();
    const c = await cita(ctx);
    await cancelar(c, ctx.tokenCliente);
    const res = await api(ctx.tokenCliente).get(`/citas/${c.id_cita}/historial`);
    expect(res.body.data).toEqual([expect.objectContaining({ campo: "estado", valor_nuevo: "cancelada", realizado_por: "dueno" })]);
    expect((await api(await tokenDe(await crearUsuario())).get(`/citas/${c.id_cita}/historial`)).status).toBe(403);
  });
});

describe("historial_cumplimiento del cliente", () => {
  it("el detalle del panel cuenta solo las citas del negocio que consulta, nunca las de otros negocios", async () => {
    const ctx = await contexto();
    const otro = await contexto();
    const enA = (overrides) => cita(ctx, overrides);
    await enA({ estado: "completada", fecha: sumarDias(HOY, -5) });
    await enA({ estado: "no_asistio", fecha: sumarDias(HOY, -4) });
    await enA({ estado: "no_asistio", fecha: sumarDias(HOY, -3) });
    await enA({ estado: "cancelada", cancelacion_tardia: true, fecha: sumarDias(HOY, -2) });
    await enA({ estado: "cancelada", cancelacion_tardia: false, fecha: sumarDias(HOY, -1) });
    // El mismo cliente en otro negocio: 3 inasistencias y 1 cancelación tardía que no deben contar.
    for (let i = 0; i < 3; i++) {
      await crearCita(otro.negocio, { cliente: ctx.cliente, mascota: ctx.mascota, estado: "no_asistio", fecha: sumarDias(HOY, -10 - i) });
    }
    await crearCita(otro.negocio, { cliente: ctx.cliente, mascota: ctx.mascota, estado: "cancelada", cancelacion_tardia: true });
    const actual = await enA({});

    const panel = await api(ctx.tokenPropietario).get(`/citas/${actual.id_cita}`);
    expect(panel.body.data.cliente.historial_cumplimiento).toEqual({ completadas: 1, inasistencias: 2, cancelaciones_tardias: 1 });

    const dueno = await api(ctx.tokenCliente).get(`/citas/${actual.id_cita}`);
    expect(dueno.body.data.cliente).not.toHaveProperty("historial_cumplimiento");
  });
});

describe("GET /citas/:id_cita (detalle del panel, B4)", () => {
  it("trae el perfil de la mascota y el contacto del cliente con citas.ver, sin clientes.ver", async () => {
    const ctx = await contexto();
    await pool.query(
      "UPDATE mascotas SET raza = 'Criolla', peso = 4.2, tiene_alergias = TRUE, alergias_detalle = 'Penicilina', fecha_nacimiento = CURDATE() - INTERVAL 38 MONTH WHERE id_mascota = ?",
      [ctx.mascota.id_mascota]
    );
    await pool.query("UPDATE usuarios SET ultimo_acceso = NOW() WHERE id_usuario = ?", [ctx.cliente.id_usuario]);
    const c = await cita(ctx);
    const usuario = await crearUsuario();
    await crearEmpleado(ctx.negocio, { usuario, rol: (await crearRol(ctx.negocio, { citas: ["ver"] })).id_rol });

    const res = await api(await tokenDe(usuario)).get(`/citas/${c.id_cita}`);
    expect(res.status).toBe(200);
    expect(res.body.data.mascota).toMatchObject({
      raza: "Criolla",
      edad_meses: 38,
      peso: 4.2,
      tiene_alergias: true,
      alergias_detalle: "Penicilina",
      fallecido: false,
    });
    expect(res.body.data.cliente).toMatchObject({ email: ctx.cliente.email, usa_app: true });
    // El dueño no recibe la vista del panel.
    const dueno = await api(ctx.tokenCliente).get(`/citas/${c.id_cita}`);
    expect(dueno.body.data.cliente).not.toHaveProperty("usa_app");
  });
});

describe("GET /citas/:id_cita/profesionales-libres", () => {
  const libres = (c, token) => api(token).get(`/citas/${c.id_cita}/profesionales-libres`);

  it("marca a quién está libre a la hora de la cita, al actual y por qué no está libre", async () => {
    const ctx = await contexto();
    const pedro = await crearEmpleado(ctx.negocio, { nombre: "Pedro", apellido: "Mora" });
    await asignarEmpleados(ctx.servicio, [pedro]);
    const c = await cita(ctx);
    await cita(ctx, { id_empleado: ctx.luis.id_empleado, hora_inicio: "09:15:00", hora_fin: "09:45:00", mascota: await crearMascota(ctx.cliente) });
    await pool.query("INSERT INTO disponibilidad_empleado (id_empleado, tipo, fecha_especifica) VALUES (?, 'vacacion', ?)", [
      pedro.id_empleado,
      LUNES,
    ]);

    const res = await libres(c, ctx.tokenPropietario);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id_cita: c.id_cita, fecha: LUNES, hora_inicio: "09:00", hora_fin: "09:30" });
    const porNombre = Object.fromEntries(res.body.data.profesionales.map((p) => [p.nombre, p]));
    expect(porNombre.Ana).toMatchObject({ actual: true, libre: true, motivo: null });
    expect(porNombre.Luis).toMatchObject({ actual: false, libre: false, motivo: "Tiene otra cita a esa hora" });
    expect(porNombre.Pedro).toMatchObject({
      libre: false,
      motivo: "No está disponible a esa hora (horario, bloqueo o vacaciones)",
    });
  });

  it("solo pendientes o confirmadas (409); sin citas.editar (403)", async () => {
    const ctx = await contexto();
    expect((await libres(await cita(ctx, { estado: "completada" }), ctx.tokenPropietario)).status).toBe(409);
    const usuario = await crearUsuario();
    await crearEmpleado(ctx.negocio, { usuario, rol: (await crearRol(ctx.negocio, { citas: ["ver", "crear"] })).id_rol });
    expect((await libres(await cita(ctx), await tokenDe(usuario))).status).toBe(403);
  });
});

describe("GET /negocios/:id_negocio/citas/horarios-libres con id_cita_excluir", () => {
  const horarios = (ctx, query, token = ctx.tokenPropietario) =>
    api(token).get(
      `/negocios/${ctx.negocio.id_negocio}/citas/horarios-libres?id_servicio=${ctx.servicio.id_servicio}&id_sucursal=${ctx.sucursal.id_sucursal}&fecha=${LUNES}&id_empleado=${ctx.ana.id_empleado}${query}`
    );
  const inicios = (res) => res.body.data.horarios.map((h) => h.hora_inicio);

  it("la cita que se reprograma no ocupa su hora ni su cupo", async () => {
    const ctx = await contexto({ servicio: { max_citas_dia: 1 } });
    const c = await cita(ctx);

    const sin = await horarios(ctx, "");
    expect(sin.body.data.horarios).toEqual([]);
    expect(sin.body.data.motivo_sin_horarios).toBe("No quedan cupos para este servicio ese día");

    const con = await horarios(ctx, `&id_cita_excluir=${c.id_cita}`);
    expect(con.status).toBe(200);
    expect(inicios(con)).toEqual(expect.arrayContaining(["09:00", "09:15"]));
  });

  it("la cita debe ser del negocio (422) y exige citas.editar (403); con solo citas.editar se consultan horarios", async () => {
    const ctx = await contexto();
    const otro = await contexto();
    const ajena = await cita(otro);
    const res = await horarios(ctx, `&id_cita_excluir=${ajena.id_cita}`);
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({ id_cita_excluir: "La cita no es de este negocio" });

    const c = await cita(ctx);
    const soloCrear = await crearUsuario();
    await crearEmpleado(ctx.negocio, { usuario: soloCrear, rol: (await crearRol(ctx.negocio, { citas: ["ver", "crear"] })).id_rol });
    expect((await horarios(ctx, `&id_cita_excluir=${c.id_cita}`, await tokenDe(soloCrear))).status).toBe(403);
    expect((await horarios(ctx, "", await tokenDe(soloCrear))).status).toBe(200);

    const soloEditar = await crearUsuario();
    await crearEmpleado(ctx.negocio, { usuario: soloEditar, rol: (await crearRol(ctx.negocio, { citas: ["ver", "editar"] })).id_rol });
    expect((await horarios(ctx, `&id_cita_excluir=${c.id_cita}`, await tokenDe(soloEditar))).status).toBe(200);
  });
});
