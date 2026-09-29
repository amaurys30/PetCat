import db from "../../config/db.js";

const COLUMNAS = "id_dispositivo, id_usuario, id_sesion, token_expo, plataforma, nombre, activo, fecha_registro";

/**
 * Registra el token para el usuario y la sesión (upsert por token). Si el token ya
 * existía (otra sesión u otra cuenta en el mismo teléfono) pasa a esta y se reactiva.
 * Devuelve true si es nuevo.
 */
export const upsert = async ({ id_usuario, id_sesion, token_expo, plataforma, nombre }) => {
  const [result] = await db.query(
    `INSERT INTO dispositivos (id_usuario, id_sesion, token_expo, plataforma, nombre)
     VALUES (?, ?, ?, ?, ?) AS nuevo
     ON DUPLICATE KEY UPDATE id_usuario = nuevo.id_usuario, id_sesion = nuevo.id_sesion,
       plataforma = nuevo.plataforma, nombre = nuevo.nombre, activo = TRUE, ultimo_error = NULL`,
    [id_usuario, id_sesion, token_expo, plataforma, nombre ?? null]
  );
  // affectedRows: 1 = insertado, 2 = actualizado, 0 = sin cambios.
  return result.affectedRows === 1;
};

export const findByToken = async (token_expo) => {
  const [rows] = await db.query(`SELECT ${COLUMNAS} FROM dispositivos WHERE token_expo = ?`, [token_expo]);
  return rows[0];
};

/** Desactiva el dispositivo activo del usuario con ese token. Devuelve si había uno. */
export const desactivarDeUsuario = async (id_usuario, token_expo) => {
  const [result] = await db.query(
    "UPDATE dispositivos SET activo = FALSE WHERE id_usuario = ? AND token_expo = ? AND activo = TRUE",
    [id_usuario, token_expo]
  );
  return result.affectedRows > 0;
};

/** Dispositivos activos de un usuario (para enviarle push). */
export const findActivosDeUsuario = async (id_usuario, conn) => {
  const [rows] = await (conn ?? db).query(
    `SELECT ${COLUMNAS} FROM dispositivos WHERE id_usuario = ? AND activo = TRUE ORDER BY id_dispositivo`,
    [id_usuario]
  );
  return rows;
};
