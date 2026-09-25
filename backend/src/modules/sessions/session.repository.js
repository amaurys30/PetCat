import pool from "../../config/db.js";

/**
 * Crear sesión
 */
export const createSession = async (data) => {
  const {
    id_usuario,
    token,
    refresh_token,
    dispositivo,
    ip_address,
    user_agent,
    expira_en
  } = data;

  const [result] = await pool.query(
    `INSERT INTO sesiones 
    (id_usuario, token, refresh_token, dispositivo, ip_address, user_agent, expira_en)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id_usuario, token, refresh_token, dispositivo, ip_address, user_agent, expira_en]
  );

  return result;
};

/**
 * Buscar sesión activa
 */
export const findSessionByToken = async (token) => {
  const [rows] = await pool.query(
    "SELECT * FROM sesiones WHERE token = ? AND activa = 1 LIMIT 1",
    [token]
  );
  return rows[0];
};

/**
 * logout
 */

export const deactivateSession = async (token) => {
  await pool.query(
    "UPDATE sesiones SET activa = FALSE WHERE token = ?",
    [token]
  );
};


export const invalidateSession = async (token) => {
  await pool.query(
    `UPDATE sesiones SET activa = 0 WHERE token = ?`,
    [token]
  );
};
