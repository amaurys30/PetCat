import db from "../../config/db.js";

export const findById = async (id_rol, conn) => {
  const [rows] = await (conn ?? db).query("SELECT * FROM roles WHERE id_rol = ?", [id_rol]);
  return rows[0];
};

/**
 * Roles que puede usar un negocio: los del sistema y los propios, con cuántos
 * empleados activos del negocio tienen cada uno.
 */
export const findByNegocio = async (id_negocio) => {
  const [rows] = await db.query(
    `SELECT r.id_rol, r.id_negocio, r.nombre, r.descripcion, r.permisos_json, r.es_sistema, r.fecha_creacion,
            (SELECT COUNT(*) FROM empleados e
             WHERE e.id_rol = r.id_rol AND e.id_negocio = ? AND e.activo = TRUE) AS empleados_activos
     FROM roles r
     WHERE r.es_sistema = TRUE OR r.id_negocio = ?
     ORDER BY r.es_sistema DESC, r.nombre`,
    [id_negocio, id_negocio]
  );
  return rows;
};

/**
 * true si el nombre ya lo usa otro rol del negocio o un rol del sistema
 * (la comparación no distingue mayúsculas por la collation de la columna).
 */
export const existsNombre = async (nombre, id_negocio, excluirIdRol = 0) => {
  const [rows] = await db.query(
    `SELECT 1 FROM roles
     WHERE nombre = ? AND (id_negocio = ? OR es_sistema = TRUE) AND id_rol <> ?
     LIMIT 1`,
    [nombre, id_negocio, excluirIdRol]
  );
  return rows.length > 0;
};

export const create = async (id_negocio, { nombre, descripcion = null, permisos_json }) => {
  const [result] = await db.query(
    `INSERT INTO roles (id_negocio, nombre, descripcion, permisos_json, es_sistema)
     VALUES (?, ?, ?, ?, FALSE)`,
    [id_negocio, nombre, descripcion, JSON.stringify(permisos_json)]
  );
  return result.insertId;
};

export const update = async (id_rol, data) => {
  const campos = {};
  if (data.nombre !== undefined) campos.nombre = data.nombre;
  if (data.descripcion !== undefined) campos.descripcion = data.descripcion;
  if (data.permisos_json !== undefined) campos.permisos_json = JSON.stringify(data.permisos_json);

  const columnas = Object.keys(campos);
  if (columnas.length === 0) return;
  await db.query(
    `UPDATE roles SET ${columnas.map((c) => `${c} = ?`).join(", ")} WHERE id_rol = ?`,
    [...Object.values(campos), id_rol]
  );
};

export const remove = async (id_rol) => {
  await db.query("DELETE FROM roles WHERE id_rol = ?", [id_rol]);
};

/** Empleados (activos o no) con el rol: la llave foránea impide borrarlo. */
export const countEmpleados = async (id_rol) => {
  const [[row]] = await db.query("SELECT COUNT(*) AS total FROM empleados WHERE id_rol = ?", [id_rol]);
  return row.total;
};
