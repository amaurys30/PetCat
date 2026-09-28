import db from "../../config/db.js";

// ---------- Escritura en la transacción del cambio ----------

/** Notificación en la app (canal in_app). `datos_extra_json`: ids del deep link y textos de push y correo. */
export const createNotificacion = async ({ id_usuario, id_negocio, tipo, titulo, mensaje, datos }, conn) => {
  const [result] = await conn.query(
    `INSERT INTO notificaciones (id_usuario, id_negocio, tipo, titulo, mensaje, datos_extra_json, canal, estado)
     VALUES (?, ?, ?, ?, ?, ?, 'in_app', 'enviada')`,
    [id_usuario, id_negocio ?? null, tipo, titulo, mensaje, JSON.stringify(datos)]
  );
  return result.insertId;
};

export const createEnvio = async ({ id_notificacion, canal, id_dispositivo, programado_para }, conn) => {
  const [result] = await conn.query(
    `INSERT INTO notificaciones_envios (id_notificacion, canal, id_dispositivo, programado_para)
     VALUES (?, ?, ?, ?)`,
    [id_notificacion, canal, id_dispositivo ?? null, programado_para]
  );
  return result.insertId;
};

/** Preferencias y contacto de los destinatarios, por id. */
export const findDestinatarios = async (ids, conn) => {
  if (ids.length === 0) return {};
  const [rows] = await (conn ?? db).query(
    `SELECT id_usuario, nombre, email, activo, notif_push, notif_email FROM usuarios WHERE id_usuario IN (?)`,
    [ids]
  );
  return Object.fromEntries(rows.map((row) => [row.id_usuario, row]));
};

/** Dispositivos activos de varios usuarios: { id_usuario: [dispositivo, ...] }. */
export const findDispositivosActivos = async (ids, conn) => {
  if (ids.length === 0) return {};
  const [rows] = await (conn ?? db).query(
    `SELECT id_dispositivo, id_usuario FROM dispositivos WHERE id_usuario IN (?) AND activo = TRUE ORDER BY id_dispositivo`,
    [ids]
  );
  const porUsuario = {};
  for (const row of rows) (porUsuario[row.id_usuario] ??= []).push(row);
  return porUsuario;
};

/** ¿Ya hay una notificación de este tipo para el negocio desde `desde` (deduplicación de avisos)? */
export const existeDesde = async ({ tipo, id_negocio, desde }, conn) => {
  const [rows] = await (conn ?? db).query(
    "SELECT 1 FROM notificaciones WHERE tipo = ? AND id_negocio = ? AND fecha_creacion >= ? LIMIT 1",
    [tipo, id_negocio, desde]
  );
  return rows.length > 0;
};

// ---------- Envíos (después del commit y en el job) ----------

/**
 * Toma el envío para procesarlo: suma un intento y lo aparta hasta `hasta` (si el proceso
 * se cae a mitad, el job lo retoma después). Solo si sigue pendiente y ya le tocaba.
 * Devuelve false si otro proceso lo tomó o aún no toca.
 *
 * Es la exclusión entre procesos (p. ej. dos instancias durante un despliegue, o el job y
 * el despacho después del commit): el UPDATE condicional es atómico en InnoDB; si dos lo
 * intentan a la vez, el segundo espera el bloqueo de la fila, vuelve a evaluar el WHERE con
 * `programado_para` ya movido a `hasta` y no afecta filas. El apartado (5 minutos) debe ser
 * mayor que el tiempo máximo de un envío (SMTP_TIMEOUT_MS, 10 s; Expo, segundos).
 */
export const reclamarEnvio = async (id_envio, ahora, hasta) => {
  const [result] = await db.query(
    `UPDATE notificaciones_envios SET intentos = intentos + 1, programado_para = ?
     WHERE id_envio = ? AND estado = 'pendiente' AND programado_para <= ?`,
    [hasta, id_envio, ahora]
  );
  return result.affectedRows === 1;
};

/** Envío con su notificación, el destinatario y el dispositivo (si es push). */
export const findEnvio = async (id_envio) => {
  const [rows] = await db.query(
    `SELECT e.id_envio, e.canal, e.intentos, e.id_dispositivo,
            n.id_notificacion, n.tipo, n.titulo, n.datos_extra_json,
            u.id_usuario, u.nombre, u.email, u.activo AS usuario_activo, u.notif_push, u.notif_email,
            d.token_expo, d.activo AS dispositivo_activo
     FROM notificaciones_envios e
     JOIN notificaciones n ON n.id_notificacion = e.id_notificacion
     JOIN usuarios u ON u.id_usuario = n.id_usuario
     LEFT JOIN dispositivos d ON d.id_dispositivo = e.id_dispositivo
     WHERE e.id_envio = ?`,
    [id_envio]
  );
  return rows[0];
};

export const marcarEnviado = async (id_envio, { ticket = null } = {}) => {
  await db.query(
    `UPDATE notificaciones_envios
     SET estado = 'enviado', fecha_envio = NOW(), error = NULL, ticket_expo = ?, recibo_pendiente = ?
     WHERE id_envio = ?`,
    [ticket, ticket !== null, id_envio]
  );
};

/** Terminado sin enviar (preferencia apagada, dispositivo dado de baja) o fallido definitivo. */
export const marcarFinal = async (id_envio, estado, error) => {
  await db.query("UPDATE notificaciones_envios SET estado = ?, error = ? WHERE id_envio = ?", [
    estado,
    String(error).slice(0, 500),
    id_envio,
  ]);
};

export const reprogramar = async (id_envio, programado_para, error) => {
  await db.query("UPDATE notificaciones_envios SET programado_para = ?, error = ? WHERE id_envio = ?", [
    programado_para,
    String(error).slice(0, 500),
    id_envio,
  ]);
};

/** Pendientes a los que ya les toca, los más antiguos primero. */
export const findPendientesVencidos = async (ahora, limite) => {
  const [rows] = await db.query(
    `SELECT id_envio FROM notificaciones_envios
     WHERE estado = 'pendiente' AND programado_para <= ?
     ORDER BY programado_para, id_envio LIMIT ?`,
    [ahora, limite]
  );
  return rows.map((row) => row.id_envio);
};

/** Push enviadas hace al menos `antesDe` cuyo recibo de Expo no se ha revisado. */
export const findRecibosPendientes = async (antesDe, limite) => {
  const [rows] = await db.query(
    `SELECT id_envio, id_dispositivo, ticket_expo FROM notificaciones_envios
     WHERE recibo_pendiente = TRUE AND fecha_envio <= ?
     ORDER BY fecha_envio LIMIT ?`,
    [antesDe, limite]
  );
  return rows;
};

export const cerrarRecibo = async (id_envio, error = null) => {
  await db.query(
    `UPDATE notificaciones_envios
     SET recibo_pendiente = FALSE, estado = IF(? IS NULL, estado, 'fallido'), error = COALESCE(?, error)
     WHERE id_envio = ?`,
    [error, error, id_envio]
  );
};

export const desactivarDispositivo = async (id_dispositivo, error) => {
  await db.query("UPDATE dispositivos SET activo = FALSE, ultimo_error = ? WHERE id_dispositivo = ?", [
    String(error).slice(0, 255),
    id_dispositivo,
  ]);
};

// ---------- Baja de correos ----------

export const desactivarCorreos = async (id_usuario) => {
  const [result] = await db.query("UPDATE usuarios SET notif_email = FALSE WHERE id_usuario = ?", [id_usuario]);
  return result.affectedRows > 0;
};
