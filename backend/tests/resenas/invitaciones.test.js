import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { pushSender } from "../../src/shared/utils/push.js";
import { clearOutbox, outbox } from "../../src/shared/utils/mailer.js";
import { momentoInvitacion } from "../../src/modules/resenas/resena.plazo.js";
import { enviarInvitacionesResena } from "../../src/modules/resenas/resena.jobs.js";
import { silencioDe } from "../../src/modules/notificaciones/silencio.js";
import { aDatetimeSQL } from "../../src/shared/utils/fechas.js";
import { api } from "../helpers/api.js";
import {
  configurarSilencio,
  crearCita,
  crearDispositivo,
  crearMascota,
  crearNegocio,
  crearServicio,
  crearUsuario,
  tokenDe,
} from "../helpers/factories.js";
import { enOtroProceso } from "../helpers/procesos.js";

/**
 * Invitación a reseñar (2.6): se programa al completar la cita y la envía su job. Las citas
 * del job son de 2033, cada test en días propios: el job solo toma invitaciones programadas
 * dentro del plazo para reseñar antes de `ahora`.
 */

beforeEach(async () => {
  pushSender.reiniciar();
  clearOutbox();
  await configurarSilencio("21:00", "07:00");
});
afterEach(() => pushSender.reiniciar());

/** Fecha y hora de Bogotá (la del proceso). */
const a = (fecha, hora) => new Date(`${fecha}T${hora}`);
const SILENCIO = silencioDe({ inicio: "21:00", fin: "07:00" });

describe("momento de la invitación", () => {
  it("3 horas después; entre las 20:00 y las 10:00 se corre a las 10:00", () => {
    const momento = (fecha, hora) => aDatetimeSQL(momentoInvitacion(a(fecha, hora), 3, SILENCIO));
    expect(momento("2033-01-10", "11:00:00")).toBe("2033-01-10 14:00:00");
    expect(momento("2033-01-10", "16:59:00")).toBe("2033-01-10 19:59:00");
    expect(momento("2033-01-10", "17:00:00")).toBe("2033-01-11 10:00:00"); // 20:00
    expect(momento("2033-01-10", "22:30:00")).toBe("2033-01-11 10:00:00"); // 01:30
    expect(momento("2033-01-10", "06:00:00")).toBe("2033-01-10 10:00:00"); // 09:00
    expect(momento("2033-01-10", "07:00:00")).toBe("2033-01-10 10:00:00");
    // Sin horario de silencio, siempre 3 horas después.
    expect(aDatetimeSQL(momentoInvitacion(a("2033-01-10", "22:30:00"), 3, silencioDe({ inicio: "00:00", fin: "00:00" })))).toBe(
      "2033-01-11 01:30:00"
    );
  });

  it("completar la cita guarda fecha_completada y programa la invitación", async () => {
    const negocio = await crearNegocio();
    const [[{ hoy }]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoy");
    const cita = await crearCita(negocio, { fecha: hoy, estado: "en_curso" });

    const res = await api(await tokenDe(negocio.propietario)).patch(`/citas/${cita.id_cita}/estado`).send({ estado: "completada" });
    expect(res.status).toBe(200);
    expect(res.body.data.fecha_completada).not.toBeNull();

    const [[invitacion]] = await pool.query(
      "SELECT estado, fecha_programada, canal FROM recordatorios WHERE id_cita = ? AND tipo = 'resena_invitacion'",
      [cita.id_cita]
    );
    const [fecha, hora] = res.body.data.fecha_completada.split(" ");
    expect(invitacion).toEqual({
      estado: "pendiente",
      canal: "push",
      fecha_programada: aDatetimeSQL(momentoInvitacion(a(fecha, hora), 3, SILENCIO)),
    });
  });
});

/** Cita completada el `fecha` a las `hora`, con su invitación programada 3 horas después. */
const citaConInvitacion = async (fecha, hora, { cliente, negocio, conDispositivo = true } = {}) => {
  const n = negocio ?? (await crearNegocio(null, { nombre: "Clínica Patitas" }));
  const dueno = cliente ?? (await crearUsuario());
  const dispositivo = conDispositivo ? await crearDispositivo(dueno) : null;
  const completada = a(fecha, hora);
  const cita = await crearCita(n, {
    cliente: dueno,
    mascota: await crearMascota(dueno, { nombre: "Max" }),
    servicio: await crearServicio(n, { nombre: "Baño y corte" }),
    fecha,
    estado: "completada",
    fecha_completada: aDatetimeSQL(completada),
  });
  await pool.query(
    `INSERT INTO recordatorios (id_usuario, id_cita, tipo, titulo, mensaje, canal, fecha_programada)
     VALUES (?, ?, 'resena_invitacion', 'Invitación', 'Invitación', 'push', ?)`,
    [dueno.id_usuario, cita.id_cita, aDatetimeSQL(momentoInvitacion(completada, 3, SILENCIO))]
  );
  return { cita, cliente: dueno, negocio: n, dispositivo };
};

const invitacion = async (id_cita) => {
  const [[row]] = await pool.query(
    "SELECT estado, error_detalle, fecha_envio FROM recordatorios WHERE id_cita = ? AND tipo = 'resena_invitacion'",
    [id_cita]
  );
  return row;
};
const notificacionesDe = async (usuario) => {
  const [rows] = await pool.query("SELECT tipo, titulo, mensaje FROM notificaciones WHERE id_usuario = ? ORDER BY id_notificacion", [
    usuario.id_usuario,
  ]);
  return rows;
};

describe("job de invitaciones", () => {
  it("invita al dueño una sola vez, por push y sin correo", async () => {
    const { cita, cliente, dispositivo } = await citaConInvitacion("2033-02-07", "11:00:00");
    const sinApp = await citaConInvitacion("2033-02-07", "11:00:00", { conDispositivo: false });

    expect(await enviarInvitacionesResena({ ahora: a("2033-02-07", "13:59:00") })).toBe(0);
    await enviarInvitacionesResena({ ahora: a("2033-02-07", "14:00:30") });

    expect(await notificacionesDe(cliente)).toEqual([
      {
        tipo: "resena_invitacion",
        titulo: "¿Cómo te fue en Clínica Patitas?",
        mensaje: "Max tuvo Baño y corte en Clínica Patitas. Tienes hasta el miércoles, 9 de marzo a las 11:00 a. m. para calificar tu experiencia.",
      },
    ]);
    expect(pushSender.enviados).toEqual([
      expect.objectContaining({
        to: dispositivo.token_expo,
        body: "Cuéntanos cómo te fue en Clínica Patitas. Tu reseña ayuda a otros dueños de mascotas.",
      }),
    ]);
    expect(await invitacion(cita.id_cita)).toMatchObject({ estado: "enviado", fecha_envio: "2033-02-07 14:00:30" });
    expect((await notificacionesDe(sinApp.cliente)).map((n) => n.tipo)).toEqual(["resena_invitacion"]);
    expect(outbox).toEqual([]);

    expect(await enviarInvitacionesResena({ ahora: a("2033-02-07", "14:05:00") })).toBe(0);
  });

  it("entre las 20:00 y las 10:00 no hace nada: lo atrasado sale a las 10:00", async () => {
    const { cita, cliente } = await citaConInvitacion("2033-02-14", "16:00:00"); // 19:00
    expect(await enviarInvitacionesResena({ ahora: a("2033-02-14", "22:00:00") })).toBe(0);
    expect(await enviarInvitacionesResena({ ahora: a("2033-02-15", "09:55:00") })).toBe(0);
    expect((await invitacion(cita.id_cita)).estado).toBe("pendiente");

    await enviarInvitacionesResena({ ahora: a("2033-02-15", "10:00:00") });
    expect((await notificacionesDe(cliente)).map((n) => n.tipo)).toEqual(["resena_invitacion"]);
  });

  it("no invita si ya reseñó, si es personal del negocio o si terminó el plazo", async () => {
    const yaReseno = await citaConInvitacion("2033-03-07", "11:00:00");
    await pool.query("INSERT INTO resenas (id_negocio, id_usuario, id_cita, calificacion) VALUES (?, ?, ?, 5)", [
      yaReseno.negocio.id_negocio,
      yaReseno.cliente.id_usuario,
      yaReseno.cita.id_cita,
    ]);
    const negocio = await crearNegocio();
    const propietario = await citaConInvitacion("2033-03-07", "11:00:00", { negocio, cliente: negocio.propietario });
    const vencida = await citaConInvitacion("2033-03-07", "11:00:00");
    await pool.query("UPDATE citas SET fecha_completada = '2033-02-01 11:00:00' WHERE id_cita = ?", [vencida.cita.id_cita]);

    expect(await enviarInvitacionesResena({ ahora: a("2033-03-07", "14:00:30") })).toBe(0);
    expect(await invitacion(yaReseno.cita.id_cita)).toMatchObject({ estado: "cancelado", error_detalle: "Ya dejó su reseña" });
    expect(await invitacion(propietario.cita.id_cita)).toMatchObject({ estado: "cancelado", error_detalle: "Es personal del negocio" });
    expect(await invitacion(vencida.cita.id_cita)).toMatchObject({ estado: "cancelado", error_detalle: "Terminó el plazo para reseñar" });
  });

  it("no invita a reseñar la visita si la mascota falleció después de la cita", async () => {
    const { cita, cliente } = await citaConInvitacion("2033-03-14", "11:00:00");
    await pool.query("UPDATE mascotas SET fallecido = TRUE, fecha_fallecimiento = '2033-03-14' WHERE id_mascota = ?", [
      cita.id_mascota,
    ]);

    expect(await enviarInvitacionesResena({ ahora: a("2033-03-14", "14:00:30") })).toBe(0);
    expect(await invitacion(cita.id_cita)).toMatchObject({ estado: "cancelado", error_detalle: "La mascota falleció" });
    expect(await notificacionesDe(cliente)).toEqual([]);
    expect(pushSender.enviados).toEqual([]);
  });
});

describe("mascota fallecida: no recibe recordatorios", () => {
  it("vacunas: ya excluidas (tests/recordatorios/vacunas.test.js); controles y desparasitaciones no tienen recordatorios programados", async () => {
    const [tipos] = await pool.query(
      `SELECT DISTINCT tipo FROM recordatorios WHERE tipo IN ('control_medico', 'desparasitacion')`
    );
    // Ningún flujo de la API los programa (solo existen en el ENUM de la tabla): nada que cancelar.
    expect(tipos).toEqual([]);
  });
});

describe("dos instancias del job", () => {
  it("cada invitación sale una sola vez", async () => {
    const citas = [];
    for (let i = 0; i < 20; i++) citas.push(await citaConInvitacion("2033-04-11", "11:00:00"));
    const tokens = citas.map((c) => c.dispositivo.token_expo);
    const ahora = a("2033-04-11", "14:00:30");

    const correr = () =>
      enOtroProceso(`
        const { pushSender } = await import("./src/shared/utils/push.js");
        const { enviarInvitacionesResena } = await import("./src/modules/resenas/resena.jobs.js");
        pushSender.retrasoMs = 30;
        await enviarInvitacionesResena({ ahora: new Date(${ahora.getTime()}) });
        return pushSender.enviados.map((m) => m.to);`);
    const [uno, dos] = await Promise.all([correr(), correr()]);

    const nuestros = [...uno, ...dos].filter((t) => tokens.includes(t));
    expect(nuestros.sort()).toEqual([...tokens].sort());
    const [[{ n }]] = await pool.query(
      "SELECT COUNT(*) AS n FROM notificaciones WHERE tipo = 'resena_invitacion' AND id_usuario IN (?)",
      [citas.map((c) => c.cliente.id_usuario)]
    );
    expect(n).toBe(20);
  }, 30_000);
});
