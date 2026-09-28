import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { pushSender } from "../../src/shared/utils/push.js";
import { clearOutbox, outbox } from "../../src/shared/utils/mailer.js";
import { enviarRecordatoriosCitas } from "../../src/modules/recordatorios/recordatorio.service.js";
import { registrarFallo } from "../../src/modules/recordatorios/recordatorio.repository.js";
import {
  configurarSilencio,
  crearCita,
  crearDispositivo,
  crearMascota,
  crearNegocio,
  crearServicio,
  crearSucursal,
  crearUsuario,
} from "../helpers/factories.js";
import { enOtroProceso } from "../helpers/procesos.js";

/**
 * Job de recordatorios de citas (2.4). Usa citas en 2031 y 2032, cada test en días
 * propios: el job solo mira las últimas 24 horas antes de `ahora`, así que no toca los
 * recordatorios de otros archivos (que están cerca de la fecha real).
 */

beforeEach(async () => {
  pushSender.reiniciar();
  clearOutbox();
  await configurarSilencio("21:00", "07:00");
});
afterEach(() => pushSender.reiniciar());

/** Fecha y hora de Bogotá (la del proceso). */
const a = (fecha, hora) => new Date(`${fecha}T${hora}`);

/** Cita confirmada con sus recordatorios programados por el trigger, de un cliente propio. */
const citaConfirmada = async (fecha, hora_inicio, { conDispositivo = true } = {}) => {
  const negocio = await crearNegocio(null, { nombre: "Clínica Patitas" });
  const sucursal = await crearSucursal(negocio, { nombre: "Sede Centro", direccion: "Calle 23 # 18-45" });
  const servicio = await crearServicio(negocio, { nombre: "Consulta general" });
  const cliente = await crearUsuario();
  const mascota = await crearMascota(cliente, { nombre: "Max" });
  const dispositivo = conDispositivo ? await crearDispositivo(cliente) : null;
  const fin = new Date(a(fecha, hora_inicio).getTime() + 30 * 60_000);
  const cita = await crearCita(negocio, {
    cliente,
    mascota,
    servicio,
    id_sucursal: sucursal.id_sucursal,
    fecha,
    hora_inicio: `${hora_inicio}:00`,
    hora_fin: `${String(fin.getHours()).padStart(2, "0")}:${String(fin.getMinutes()).padStart(2, "0")}:00`,
    estado: "pendiente",
  });
  await pool.query("UPDATE citas SET estado = 'confirmada' WHERE id_cita = ?", [cita.id_cita]);
  return { cita, cliente, dispositivo };
};

const recordatorios = async (id_cita) => {
  const [rows] = await pool.query(
    "SELECT tipo, estado, intentos, fecha_envio, error_detalle FROM recordatorios WHERE id_cita = ? ORDER BY fecha_programada",
    [id_cita]
  );
  return Object.fromEntries(rows.map((r) => [r.tipo, r]));
};
const notificacionesDe = async (usuario) => {
  const [rows] = await pool.query("SELECT tipo, titulo, mensaje FROM notificaciones WHERE id_usuario = ? ORDER BY id_notificacion", [
    usuario.id_usuario,
  ]);
  return rows;
};

describe("recordatorios de citas", () => {
  it("el del día anterior a las 19:00 y el de 2 horas antes, cada uno una sola vez", async () => {
    const { cita, cliente, dispositivo } = await citaConfirmada("2031-03-11", "09:00");

    await enviarRecordatoriosCitas({ ahora: a("2031-03-10", "19:00:30") });
    expect(await notificacionesDe(cliente)).toEqual([
      expect.objectContaining({ tipo: "cita_dia_anterior", titulo: "Tu cita es mañana" }),
    ]);
    const [notificacion] = await notificacionesDe(cliente);
    expect(notificacion.mensaje).toContain("Max tiene Consulta general en Clínica Patitas (Sede Centro, Calle 23 # 18-45)");
    expect(pushSender.enviados).toEqual([
      expect.objectContaining({
        to: dispositivo.token_expo,
        title: "Tu cita es mañana",
        body: "Mañana a las 9:00 a. m. tienes una cita con Clínica Patitas.",
        priority: "default",
      }),
    ]);
    expect((await recordatorios(cita.id_cita)).cita_dia_anterior).toMatchObject({
      estado: "enviado",
      intentos: 1,
      fecha_envio: "2031-03-10 19:00:30",
    });
    expect((await recordatorios(cita.id_cita)).cita_recordatorio.estado).toBe("pendiente");

    // Otra corrida a la misma hora no repite nada.
    expect(await enviarRecordatoriosCitas({ ahora: a("2031-03-10", "19:01:30") })).toBe(0);

    await enviarRecordatoriosCitas({ ahora: a("2031-03-11", "07:00:30") });
    expect((await notificacionesDe(cliente)).map((n) => n.tipo)).toEqual(["cita_dia_anterior", "cita_recordatorio"]);
    expect(pushSender.enviados.at(-1).body).toBe("Hoy a las 9:00 a. m. tienes una cita con Clínica Patitas.");
    expect((await recordatorios(cita.id_cita)).cita_recordatorio.estado).toBe("enviado");
    const [[fila]] = await pool.query("SELECT recordatorio_enviado FROM citas WHERE id_cita = ?", [cita.id_cita]);
    expect(fila.recordatorio_enviado).toBe(1);
  });

  it("el de 2 horas antes de una cita temprana es urgente: sale en el horario de silencio y con prioridad alta", async () => {
    const { cita, cliente } = await citaConfirmada("2031-03-12", "07:30");
    await enviarRecordatoriosCitas({ ahora: a("2031-03-12", "05:30:30") });

    expect((await notificacionesDe(cliente)).map((n) => n.tipo)).toContain("cita_recordatorio");
    expect(pushSender.enviados).toHaveLength(1);
    expect(pushSender.enviados[0].priority).toBe("high");
    expect((await recordatorios(cita.id_cita)).cita_recordatorio.estado).toBe("enviado");
  });

  it("sin dispositivo, el dueño lo recibe por correo", async () => {
    const { cliente } = await citaConfirmada("2031-03-13", "10:00", { conDispositivo: false });
    await enviarRecordatoriosCitas({ ahora: a("2031-03-12", "19:00:30") });

    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: cliente.email, subject: "Recordatorio: tu cita de mañana en Clínica Patitas" });
    expect(outbox[0].text).toContain("Dónde: Clínica Patitas — Sede Centro, Calle 23 # 18-45.");
  });

  it("una cita que ya no está confirmada: el recordatorio se cancela sin avisar", async () => {
    const { cita, cliente } = await citaConfirmada("2031-03-15", "10:00");
    // Sin pasar por el endpoint, que ya cancela los recordatorios pendientes.
    await pool.query("UPDATE citas SET estado = 'cancelada' WHERE id_cita = ?", [cita.id_cita]);
    await enviarRecordatoriosCitas({ ahora: a("2031-03-14", "19:00:30") });

    expect(await notificacionesDe(cliente)).toEqual([]);
    expect((await recordatorios(cita.id_cita)).cita_dia_anterior).toMatchObject({
      estado: "cancelado",
      error_detalle: "La cita está cancelada",
    });
  });

  it("tras una caída: el del día anterior no sale de noche, lo que ya empezó se descarta y lo de más de 24 horas no se toca", async () => {
    const noche = await citaConfirmada("2031-03-17", "10:00");
    await enviarRecordatoriosCitas({ ahora: a("2031-03-16", "22:00:00") });
    expect(await notificacionesDe(noche.cliente)).toEqual([]);
    expect((await recordatorios(noche.cita.id_cita)).cita_dia_anterior).toMatchObject({
      estado: "cancelado",
      error_detalle: "Llegó tarde: lo cubre el recordatorio de 2 horas antes",
    });

    const empezada = await citaConfirmada("2031-03-20", "09:00");
    await enviarRecordatoriosCitas({ ahora: a("2031-03-20", "19:30:00") });
    const filas = await recordatorios(empezada.cita.id_cita);
    expect(filas.cita_dia_anterior.estado).toBe("pendiente"); // 19:00 del 19: más de 24 horas de atraso
    expect(filas.cita_recordatorio).toMatchObject({ estado: "cancelado", error_detalle: "La cita ya empezó" });
    expect(await notificacionesDe(empezada.cliente)).toEqual([]);
  });

  it("un fallo suma un intento y al tercero queda fallido", async () => {
    const { cita } = await citaConfirmada("2031-03-25", "10:00");
    const [[{ id_recordatorio }]] = await pool.query(
      "SELECT id_recordatorio FROM recordatorios WHERE id_cita = ? AND tipo = 'cita_recordatorio'",
      [cita.id_cita]
    );
    for (let i = 0; i < 2; i++) await registrarFallo(id_recordatorio, "Error simulado", 3);
    expect((await recordatorios(cita.id_cita)).cita_recordatorio).toMatchObject({ estado: "pendiente", intentos: 2 });
    await registrarFallo(id_recordatorio, "Error simulado", 3);
    expect((await recordatorios(cita.id_cita)).cita_recordatorio).toMatchObject({
      estado: "fallido",
      intentos: 3,
      error_detalle: "Error simulado",
    });
  });
});

describe("dos instancias del job", () => {
  it("cada recordatorio se notifica una sola vez", async () => {
    const citas = [];
    for (let i = 0; i < 20; i++) citas.push(await citaConfirmada("2032-05-11", "10:00"));
    const tokens = citas.map((c) => c.dispositivo.token_expo);
    const ahora = a("2032-05-10", "19:00:30");

    const correr = () =>
      enOtroProceso(`
        const { pushSender } = await import("./src/shared/utils/push.js");
        const { enviarRecordatoriosCitas } = await import("./src/modules/recordatorios/recordatorio.service.js");
        pushSender.retrasoMs = 30; // latencia de Expo: los dos procesos se solapan
        await enviarRecordatoriosCitas({ ahora: new Date(${ahora.getTime()}) });
        return pushSender.enviados.map((m) => m.to);`);
    const [uno, dos] = await Promise.all([correr(), correr()]);

    const nuestros = [...uno, ...dos].filter((t) => tokens.includes(t));
    expect(nuestros.sort()).toEqual([...tokens].sort()); // todos, ninguno repetido
    expect(uno.filter((t) => tokens.includes(t)).length).toBeGreaterThan(0);
    expect(dos.filter((t) => tokens.includes(t)).length).toBeGreaterThan(0);

    const ids = citas.map((c) => c.cita.id_cita);
    const [notificaciones] = await pool.query(
      "SELECT COUNT(*) AS n FROM notificaciones WHERE tipo = 'cita_dia_anterior' AND id_usuario IN (?)",
      [citas.map((c) => c.cliente.id_usuario)]
    );
    expect(notificaciones[0].n).toBe(20);
    const [filas] = await pool.query(
      "SELECT estado, intentos FROM recordatorios WHERE tipo = 'cita_dia_anterior' AND id_cita IN (?)",
      [ids]
    );
    expect(filas.every((f) => f.estado === "enviado" && f.intentos === 1)).toBe(true);
  }, 30_000);
});
