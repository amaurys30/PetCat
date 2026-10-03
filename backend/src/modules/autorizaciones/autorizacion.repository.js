import db from "../../config/db.js";

/**
 * Registra la autorización de tratamiento de datos (Ley 1581 de 2012).
 * `canal` "app": el titular se registró en la app; "panel_web": se registró en el panel web;
 * "panel": un negocio (`id_negocio`) registró al titular; "invitacion": aceptó una invitación
 * de empleado; "aceptacion": cuenta existente que aceptó la versión vigente.
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

/** Última autorización no revocada del usuario, de cualquier versión de la política. */
export const findUltima = async (id_usuario) => {
  const [rows] = await db.query(
    `SELECT canal, version_politica, fecha_autorizacion
     FROM autorizaciones_datos
     WHERE id_usuario = ? AND revocada_en IS NULL
     ORDER BY fecha_autorizacion DESC, id_autorizacion DESC
     LIMIT 1`,
    [id_usuario]
  );
  return rows[0];
};

/** Autorización no revocada del usuario para esa versión de la política (la más reciente). */
export const findVigente = async (id_usuario, version_politica, conn) => {
  const [rows] = await (conn ?? db).query(
    `SELECT id_autorizacion, canal, version_politica, fecha_autorizacion
     FROM autorizaciones_datos
     WHERE id_usuario = ? AND version_politica = ? AND revocada_en IS NULL
     ORDER BY fecha_autorizacion DESC, id_autorizacion DESC
     LIMIT 1`,
    [id_usuario, version_politica]
  );
  return rows[0];
};
