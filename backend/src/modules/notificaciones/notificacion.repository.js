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

/**
 * ¿Ya se avisó al negocio (deduplicación)? Con `desde`, un aviso de ese tipo creado desde
 * esa fecha y hora; con `mes`, un aviso de ese tipo sobre ese mes (`datos_extra_json.enlace.mes`).
 */
export const existeAviso = async ({ tipo, id_negocio, desde, mes }, conn) => {
  const [rows] = await (conn ?? db).query(
    `SELECT 1 FROM notificaciones
     WHERE tipo = ? AND id_negocio = ?
       ${desde ? "AND fecha_creacion >= ?" : ""}
       ${mes ? "AND JSON_UNQUOTE(JSON_EXTRACT(datos_extra_json, '$.enlace.mes')) = ?" : ""}
     LIMIT 1`,
    [tipo, id_negocio, ...(desde ? [desde] : []), ...(mes ? [mes] : [])]
  );
  return rows.length > 0;
};

/** Propietario y empleados activos con cuenta del negocio, con los permisos de su rol. */
export const findPersonalDelNegocio = async (id_negocio, conn) => {
  const [[negocio]] = await (conn ?? db).query("SELECT id_usuario_propietario FROM negocios WHERE id_negocio = ?", [id_negocio]);
  const [empleados] = await (conn ?? db).query(
    `SELECT e.id_usuario, r.permisos_json
     FROM empleados e JOIN roles r ON r.id_rol = e.id_rol
     WHERE e.id_negocio = ? AND e.activo = TRUE AND e.id_usuario IS NOT NULL`,
    [id_negocio]
  );
  return { id_propietario: negocio?.id_usuario_propietario ?? null, empleados };
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

// ---------- Consultas del usuario ----------

const COLUMNAS_NOTIFICACION = "id_notificacion, id_negocio, tipo, titulo, mensaje, datos_extra_json, estado, leida_en, fecha_creacion";

/** Página de notificaciones del usuario (sin archivadas), las más recientes primero. `leidas`: true, false o undefined. */
export const findPage = async (id_usuario, { leidas, limit, offset }) => {
  const filtros = ["id_usuario = ?", "estado <> 'archivada'"];
  const params = [id_usuario];
  if (leidas !== undefined) {
    filtros.push("estado = ?");
    params.push(leidas ? "leida" : "enviada");
  }
  const where = filtros.join(" AND ");
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM notificaciones WHERE ${where}`, params);
  const [rows] = await db.query(
    `SELECT ${COLUMNAS_NOTIFICACION} FROM notificaciones WHERE ${where}
     ORDER BY fecha_creacion DESC, id_notificacion DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return { rows, total };
};

export const countNoLeidas = async (id_usuario) => {
  const [[{ total }]] = await db.query(
    "SELECT COUNT(*) AS total FROM notificaciones WHERE id_usuario = ? AND estado = 'enviada'",
    [id_usuario]
  );
  return total;
};

export const findDeUsuario = async (id_notificacion, id_usuario) => {
  const [rows] = await db.query(
    `SELECT ${COLUMNAS_NOTIFICACION} FROM notificaciones WHERE id_notificacion = ? AND id_usuario = ? AND estado <> 'archivada'`,
    [id_notificacion, id_usuario]
  );
  return rows[0];
};

export const marcarLeida = async (id_notificacion, id_usuario) => {
  await db.query(
    "UPDATE notificaciones SET estado = 'leida', leida_en = NOW() WHERE id_notificacion = ? AND id_usuario = ? AND estado = 'enviada'",
    [id_notificacion, id_usuario]
  );
};

/** Marca todas las no leídas del usuario; devuelve cuántas. */
export const marcarTodasLeidas = async (id_usuario) => {
  const [result] = await db.query(
    "UPDATE notificaciones SET estado = 'leida', leida_en = NOW() WHERE id_usuario = ? AND estado = 'enviada'",
    [id_usuario]
  );
  return result.affectedRows;
};

// ---------- Baja de correos ----------

export const desactivarCorreos = async (id_usuario) => {
  const [result] = await db.query("UPDATE usuarios SET notif_email = FALSE WHERE id_usuario = ?", [id_usuario]);
  return result.affectedRows > 0;
};

// ---------- Limpieza (job semanal) ----------

/**
 * Borra hasta `limite` notificaciones leídas creadas antes de `leidasAntesDe` o cualquiera
 * creada antes de `todasAntesDe`. Sus envíos se borran en cascada. Devuelve cuántas borró.
 */
export const deleteAntiguas = async ({ leidasAntesDe, todasAntesDe, limite }) => {
  const [result] = await db.query(
    `DELETE FROM notificaciones
     WHERE (estado = 'leida' AND fecha_creacion < ?) OR fecha_creacion < ?
     ORDER BY id_notificacion
     LIMIT ?`,
    [leidasAntesDe, todasAntesDe, limite]
  );
  return result.affectedRows;
};
