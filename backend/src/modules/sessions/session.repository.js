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
