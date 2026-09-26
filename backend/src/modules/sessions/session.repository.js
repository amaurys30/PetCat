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

export const deactivate = async (id_sesion) => {
  await pool.query("UPDATE sesiones SET activa = FALSE WHERE id_sesion = ?", [id_sesion]);
};

/**
 * Sesión activa y vigente de un refresh token, bloqueada con FOR UPDATE: dos
 * renovaciones simultáneas con el mismo token no pueden pasar las dos.
 */
export const findActiveByRefreshHashForUpdate = async (refresh_token_hash, conn) => {
  const [rows] = await conn.query(
    `SELECT id_sesion, id_usuario
     FROM sesiones
     WHERE refresh_token = ? AND activa = TRUE AND expira_en > NOW()
     LIMIT 1
     FOR UPDATE`,
    [refresh_token_hash]
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

/** Cierra todas las sesiones activas del usuario salvo `exceptoIdSesion` (si se pasa). */
export const deactivateByUsuario = async (id_usuario, { exceptoIdSesion = null } = {}, conn) => {
  await (conn ?? pool).query(
    `UPDATE sesiones SET activa = FALSE
     WHERE id_usuario = ? AND activa = TRUE AND (? IS NULL OR id_sesion <> ?)`,
    [id_usuario, exceptoIdSesion, exceptoIdSesion]
  );
};
