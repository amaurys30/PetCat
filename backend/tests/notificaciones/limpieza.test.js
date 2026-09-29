import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { limpiarNotificaciones } from "../../src/modules/notificaciones/notificacion.service.js";
import { limpiarRecordatorios } from "../../src/modules/recordatorios/recordatorio.service.js";
import { crearUsuario } from "../helpers/factories.js";

/** Limpieza semanal de notificaciones y recordatorios antiguos (2.4). */

/** Notificación del usuario creada hace `dias` días, con un envío. */
const notificacion = async (usuario, dias, estado = "enviada") => {
  const [result] = await pool.query(
    `INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje, estado, fecha_creacion)
     VALUES (?, 'cita_confirmada', 't', 'm', ?, NOW() - INTERVAL ? DAY)`,
    [usuario.id_usuario, estado, dias]
  );
  await pool.query(
    "INSERT INTO notificaciones_envios (id_notificacion, canal, estado, programado_para) VALUES (?, 'email', 'enviado', NOW() - INTERVAL ? DAY)",
    [result.insertId, dias]
  );
  return result.insertId;
};
const existe = async (tabla, columna, id) => {
  const [rows] = await pool.query(`SELECT 1 FROM ${tabla} WHERE ${columna} = ?`, [id]);
  return rows.length > 0;
};

describe("limpieza de notificaciones", () => {
  it("leídas de más de 90 días y todas las de más de 180, con sus envíos", async () => {
    const usuario = await crearUsuario();
    const leidaVieja = await notificacion(usuario, 91, "leida");
    const leidaReciente = await notificacion(usuario, 60, "leida");
    const sinLeer = await notificacion(usuario, 120);
    const sinLeerMuyVieja = await notificacion(usuario, 181);

    expect(await limpiarNotificaciones()).toBeGreaterThanOrEqual(2);
    expect(await existe("notificaciones", "id_notificacion", leidaVieja)).toBe(false);
    expect(await existe("notificaciones_envios", "id_notificacion", leidaVieja)).toBe(false);
    expect(await existe("notificaciones", "id_notificacion", sinLeerMuyVieja)).toBe(false);
    expect(await existe("notificaciones", "id_notificacion", leidaReciente)).toBe(true);
    expect(await existe("notificaciones", "id_notificacion", sinLeer)).toBe(true);

    // Idempotente.
    await limpiarNotificaciones();
    expect(await existe("notificaciones", "id_notificacion", sinLeer)).toBe(true);
  });
});

describe("limpieza de recordatorios", () => {
  const recordatorio = async (usuario, dias, { tipo = "cita_recordatorio", estado = "enviado" } = {}) => {
    const [result] = await pool.query(
      `INSERT INTO recordatorios (id_usuario, tipo, titulo, mensaje, estado, fecha_programada)
       VALUES (?, ?, 't', 'm', ?, NOW() - INTERVAL ? DAY)`,
      [usuario.id_usuario, tipo, estado, dias]
    );
    return result.insertId;
  };

  it("resueltos o de citas pendientes de más de 180 días; los demás se conservan", async () => {
    const usuario = await crearUsuario();
    const enviadoViejo = await recordatorio(usuario, 200);
    const canceladoViejo = await recordatorio(usuario, 200, { estado: "cancelado" });
    const citaPendienteVieja = await recordatorio(usuario, 200, { tipo: "cita_dia_anterior", estado: "pendiente" });
    const otroPendienteViejo = await recordatorio(usuario, 200, { tipo: "medicamento", estado: "pendiente" });
    const enviadoReciente = await recordatorio(usuario, 100);

    expect(await limpiarRecordatorios()).toBeGreaterThanOrEqual(3);
    for (const id of [enviadoViejo, canceladoViejo, citaPendienteVieja]) {
      expect(await existe("recordatorios", "id_recordatorio", id)).toBe(false);
    }
    expect(await existe("recordatorios", "id_recordatorio", otroPendienteViejo)).toBe(true);
    expect(await existe("recordatorios", "id_recordatorio", enviadoReciente)).toBe(true);
  });
});
