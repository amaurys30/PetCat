import db from "../../config/db.js";

/**
 * Registra la autorización de tratamiento de datos (Ley 1581 de 2012).
 * `canal` "app": el titular se registró; "panel": lo registró un negocio.
 */
export const create = async (
  { id_usuario, canal, id_negocio = null, id_usuario_registro = null, version_politica, ip_address = null },
  conn
) => {
  const [result] = await (conn ?? db).query(
    `INSERT INTO autorizaciones_datos
       (id_usuario, canal, id_negocio, id_usuario_registro, version_politica, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id_usuario, canal, id_negocio, id_usuario_registro, version_politica, ip_address]
  );
  return result.insertId;
};

/** El negocio registró una autorización de ese usuario (lo registró desde el panel). */
export const existsDeNegocio = async (id_usuario, id_negocio, conn) => {
  const [rows] = await (conn ?? db).query(
    "SELECT 1 FROM autorizaciones_datos WHERE id_usuario = ? AND id_negocio = ? LIMIT 1",
    [id_usuario, id_negocio]
  );
  return rows.length > 0;
};
