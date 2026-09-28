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

// ---------- Vacunas ----------

/**
 * Vacunas con un hito que toca hoy y aún no se avisó: `fecha_proxima + hito` entre hoy
 * menos `gracia` días y hoy. Solo dosis no reemplazadas, de mascotas activas y vivas con
 * dueño activo. `hitos` son constantes del código (no datos del usuario).
 */
export const findHitosVacunasPendientes = async ({ hoy, hitos, gracia, limite }) => {
  const tablaHitos = hitos.map(() => "SELECT ? AS hito").join(" UNION ALL ");
  const [rows] = await db.query(
    `SELECT v.id_vacuna, v.id_mascota, h.hito
     FROM vacunas v
     JOIN (${tablaHitos}) h
       ON v.fecha_proxima BETWEEN ? - INTERVAL (h.hito + ?) DAY AND ? - INTERVAL h.hito DAY
     JOIN mascotas m ON m.id_mascota = v.id_mascota AND m.activo = TRUE AND m.fallecido = FALSE
     JOIN usuarios u ON u.id_usuario = m.id_usuario AND u.activo = TRUE
     WHERE v.estado <> 'no_aplica'
       AND NOT EXISTS (SELECT 1 FROM recordatorios r WHERE r.id_vacuna = v.id_vacuna AND r.hito = h.hito)
     ORDER BY v.fecha_proxima, v.id_vacuna
     LIMIT ?`,
    [...hitos, hoy, gracia, hoy, limite]
  );
  return rows;
};

/**
 * Bloquea la mascota (el orden de toda su salud: mascota y luego vacunas) y devuelve su
 * dueño y si puede recibir avisos.
 */
export const lockMascotaParaAviso = async (id_mascota, conn) => {
  const [rows] = await conn.query(
    `SELECT m.id_mascota, m.nombre, m.id_usuario, m.activo, m.fallecido, u.activo AS usuario_activo
     FROM mascotas m JOIN usuarios u ON u.id_usuario = m.id_usuario
     WHERE m.id_mascota = ? FOR UPDATE OF m`,
    [id_mascota]
  );
  return rows[0] ?? null;
};

/**
 * Marca el hito de la vacuna como avisado. La clave única (id_vacuna, hito) hace que solo
 * una transacción lo inserte: devuelve false si ya existía. (No se usa ON DUPLICATE KEY:
 * mysql2 activa CLIENT_FOUND_ROWS y un duplicado también contaría una fila afectada.)
 * El error de duplicado deshace solo la sentencia, no la transacción.
 */
export const insertHitoVacuna = async ({ id_usuario, id_mascota, id_vacuna, hito, tipo, titulo, mensaje, fecha }, conn) => {
  try {
    await conn.query(
      `INSERT INTO recordatorios (id_usuario, id_mascota, id_vacuna, hito, tipo, titulo, mensaje, canal, estado,
                                  fecha_programada, fecha_envio, intentos)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'push', 'enviado', ?, ?, 1)`,
      [id_usuario, id_mascota, id_vacuna, hito, tipo, titulo, mensaje, fecha, fecha]
    );
    return true;
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return false;
    throw err;
  }
};
