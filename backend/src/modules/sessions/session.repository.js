import pool from "../../config/db.js";

/**
 * Las sesiones guardan el hash SHA-256 de los tokens (columnas `token` y
 * `refresh_token`), nunca los tokens en claro. `expira_en` se recibe como
 * segundos Unix y se convierte en MySQL para usar el mismo reloj que NOW().
 */
export const create = async (
  { id_usuario, token_hash, refresh_token_hash, dispositivo, ip_address, user_agent, expira_en_unix },
  conn
) => {
  const [result] = await (conn ?? pool).query(
    `INSERT INTO sesiones
       (id_usuario, token, refresh_token, dispositivo, ip_address, user_agent, expira_en)
     VALUES (?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?))`,
    [id_usuario, token_hash, refresh_token_hash, dispositivo, ip_address, user_agent, expira_en_unix]
  );
  return result.insertId;
};

/**
 * Sesión activa y vigente del access token, con los datos del usuario que
 * necesita authMiddleware. Devuelve undefined si no existe, se cerró o expiró.
 */
export const findActiveByTokenHash = async (token_hash) => {
  const [rows] = await pool.query(
    `SELECT s.id_sesion, s.id_usuario, s.dispositivo, s.expira_en,
            u.email, u.tipo_usuario, u.activo AS usuario_activo
     FROM sesiones s
     JOIN usuarios u ON u.id_usuario = s.id_usuario
     WHERE s.token = ? AND s.activa = TRUE AND s.expira_en > NOW()
     LIMIT 1`,
    [token_hash]
  );
  return rows[0];
};

/** Cierra la sesión (logout) y desactiva el dispositivo registrado en ella: no más push. */
export const deactivate = async (id_sesion) => {
  await pool.query("UPDATE sesiones SET activa = FALSE WHERE id_sesion = ?", [id_sesion]);
  await pool.query("UPDATE dispositivos SET activo = FALSE WHERE id_sesion = ? AND activo = TRUE", [id_sesion]);
};

/**
 * Sesión activa y vigente de un refresh token, bloqueada con FOR UPDATE: dos
 * renovaciones simultáneas con el mismo token no pueden pasar las dos.
 *
 * Se busca el id sin bloquear y luego se bloquea por clave primaria, repitiendo
 * las condiciones sobre la versión más reciente de la fila. Bloquear directo por
 * el índice de refresh_token toma gap locks en ese índice, y la renovación que va
 * primero inserta en él al rotar: con varias simultáneas terminaba en deadlock (500).
 */
export const findActiveByRefreshHashForUpdate = async (refresh_token_hash, conn) => {
  const [candidatas] = await conn.query("SELECT id_sesion FROM sesiones WHERE refresh_token = ? LIMIT 1", [
    refresh_token_hash,
  ]);
  if (!candidatas[0]) return undefined;
  const [rows] = await conn.query(
    `SELECT id_sesion, id_usuario
     FROM sesiones
     WHERE id_sesion = ? AND refresh_token = ? AND activa = TRUE AND expira_en > NOW()
     FOR UPDATE`,
    [candidatas[0].id_sesion, refresh_token_hash]
  );
  return rows[0];
};

/** Rota los tokens de una sesión y extiende su vencimiento al del refresh token nuevo. */
export const rotate = async (
  id_sesion,
  { token_hash, refresh_token_hash, ip_address, user_agent, expira_en_unix },
  conn
) => {
  await (conn ?? pool).query(
    `UPDATE sesiones
     SET token = ?, refresh_token = ?, expira_en = FROM_UNIXTIME(?),
         ip_address = COALESCE(?, ip_address), user_agent = COALESCE(?, user_agent)
     WHERE id_sesion = ?`,
    [token_hash, refresh_token_hash, expira_en_unix, ip_address, user_agent, id_sesion]
  );
};

/**
 * Cierra todas las sesiones activas del usuario salvo `exceptoIdSesion` (si se pasa) y
 * desactiva los dispositivos de esas sesiones (p. ej. un teléfono robado tras cambiar la contraseña).
 */
export const deactivateByUsuario = async (id_usuario, { exceptoIdSesion = null } = {}, conn) => {
  await (conn ?? pool).query(
    `UPDATE sesiones SET activa = FALSE
     WHERE id_usuario = ? AND activa = TRUE AND (? IS NULL OR id_sesion <> ?)`,
    [id_usuario, exceptoIdSesion, exceptoIdSesion]
  );
  await (conn ?? pool).query(
    `UPDATE dispositivos SET activo = FALSE
     WHERE id_usuario = ? AND activo = TRUE AND (? IS NULL OR id_sesion IS NULL OR id_sesion <> ?)`,
    [id_usuario, exceptoIdSesion, exceptoIdSesion]
  );
};

/**
 * Borra hasta `limite` sesiones que vencieron antes de `antesDe` (activas o cerradas: una
 * cerrada también tiene su vencimiento). El id_sesion de sus dispositivos queda en NULL
 * (ON DELETE SET NULL) y el dispositivo sigue activo. Devuelve cuántas borró.
 */
export const deleteVencidasAntesDe = async (antesDe, limite) => {
  const [result] = await pool.query("DELETE FROM sesiones WHERE expira_en < ? ORDER BY id_sesion LIMIT ?", [antesDe, limite]);
  return result.affectedRows;
};
