import db from "../../config/db.js";

/**
 * Recordatorios de citas pendientes con `fecha_programada` en (desde, hasta], los más
 * antiguos primero. Sin bloqueo: cada uno se toma después en su propia transacción.
 */
export const findPendientesDeCitas = async ({ desde, hasta, limite }) => {
  const [rows] = await db.query(
    `SELECT id_recordatorio, id_cita FROM recordatorios
     WHERE estado = 'pendiente' AND tipo IN ('cita_dia_anterior', 'cita_recordatorio')
       AND fecha_programada > ? AND fecha_programada <= ?
     ORDER BY fecha_programada, id_recordatorio
     LIMIT ?`,
    [desde, hasta, limite]
  );
  return rows;
};

/**
 * Bloquea la cita sin esperar: null si otra transacción la tiene (otra instancia del job
 * o un cambio en curso, que puede cancelar sus recordatorios). Se bloquea la cita antes
 * que el recordatorio, en el mismo orden que cancelar y reprogramar.
 */
export const lockCitaSinEsperar = async (id_cita, conn) => {
  const [rows] = await conn.query(
    "SELECT id_cita, estado, fecha, hora_inicio FROM citas WHERE id_cita = ? FOR UPDATE SKIP LOCKED",
    [id_cita]
  );
  return rows[0] ?? null;
};

export const lockRecordatorio = async (id_recordatorio, conn) => {
  const [rows] = await conn.query("SELECT id_recordatorio, tipo, estado FROM recordatorios WHERE id_recordatorio = ? FOR UPDATE", [
    id_recordatorio,
  ]);
  return rows[0] ?? null;
};

export const marcarEnviado = async (id_recordatorio, fecha_envio, conn) => {
  await conn.query(
    "UPDATE recordatorios SET estado = 'enviado', fecha_envio = ?, intentos = intentos + 1, error_detalle = NULL WHERE id_recordatorio = ?",
    [fecha_envio, id_recordatorio]
  );
};

/** Ya no corresponde enviarlo; `motivo` queda en error_detalle. */
export const marcarCancelado = async (id_recordatorio, motivo, conn) => {
  await (conn ?? db).query("UPDATE recordatorios SET estado = 'cancelado', error_detalle = ? WHERE id_recordatorio = ?", [
    motivo,
    id_recordatorio,
  ]);
};

/** Suma un intento fallido; al llegar a `maxIntentos` queda `fallido`. */
export const registrarFallo = async (id_recordatorio, mensaje, maxIntentos) => {
  await db.query(
    `UPDATE recordatorios
     SET intentos = intentos + 1, error_detalle = ?, estado = IF(intentos >= ?, 'fallido', estado)
     WHERE id_recordatorio = ? AND estado = 'pendiente'`,
    [String(mensaje).slice(0, 500), maxIntentos, id_recordatorio]
  );
};

export const marcarCitaRecordada = async (id_cita, conn) => {
  await conn.query("UPDATE citas SET recordatorio_enviado = TRUE WHERE id_cita = ?", [id_cita]);
};
