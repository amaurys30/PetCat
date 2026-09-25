import db from "../../config/db.js";


export const findById = async (id_rol) => {
  const [rows] = await db.query(
    //"SELECT id_rol, nombre, permisos_json FROM roles WHERE id_rol = ?",
    "SELECT * FROM roles WHERE id_rol = ?",
    [id_rol]
  );

  return rows[0];
};

export const findByNameAndNegocio = async (
  nombre,
  id_negocio
) => {
  const [rows] = await db.query(
    `
      SELECT *
      FROM roles
      WHERE nombre = ?
      AND id_negocio = ?
      LIMIT 1
    `,
    [nombre, id_negocio]
  );

  return rows[0] || null;
};

export const create = async ({
  id_negocio,
  nombre,
  descripcion,
  permisos_json,
  es_sistema
}) => {
  const [result] = await db.query(
    `
      INSERT INTO roles (
        id_negocio,
        nombre,
        descripcion,
        permisos_json,
        es_sistema
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      id_negocio,
      nombre,
      descripcion,
      JSON.stringify(permisos_json),
      es_sistema
    ]
  );

  const [rows] = await db.query(
    `
      SELECT *
      FROM roles
      WHERE id_rol = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  return rows[0];
};

export const findAllByNegocio = async (id_negocio) => {
  const [rows] = await db.query(
    `
    SELECT
      id_rol,
      id_negocio,
      nombre,
      descripcion,
      permisos_json,
      es_sistema,
      fecha_creacion
    FROM roles
    WHERE
      es_sistema = TRUE
      OR id_negocio = ?
    ORDER BY es_sistema DESC, nombre ASC
    `,
    [id_negocio]
  );

  return rows;
};
