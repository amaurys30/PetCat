import db from "../../config/db.js";


export const createSucursal = async (data) => {
  const {
    id_negocio,
    nombre,
    descripcion,
    telefono,
    direccion,
    ciudad,
    latitud,
    longitud,
    es_principal
  } = data;

  const [result] = await db.query(
    `
    INSERT INTO sucursales (
      id_negocio, nombre, descripcion, telefono,
      direccion, ciudad, latitud, longitud, es_principal
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id_negocio,
      nombre,
      descripcion || null,
      telefono || null,
      direccion,
      ciudad || "Sincelejo",
      latitud || null,
      longitud || null,
      es_principal || false
    ]
  );

  return {
    id_sucursal: result.insertId
  };
};

export const findById = async (id_sucursal) => {
  const [rows] = await db.query(
    "SELECT * FROM sucursales WHERE id_sucursal = ?",
    [id_sucursal]
  );

  return rows[0];
};

export const clearPrincipal = async (id_negocio) => {
  await db.query(
    "UPDATE sucursales SET es_principal = FALSE WHERE id_negocio = ?",
    [id_negocio]
  );
};

export const findByNegocio = async (id_negocio) => {
  const [rows] = await db.query(
    `
    SELECT 
      id_sucursal,
      nombre,
      descripcion,
      telefono,
      direccion,
      ciudad,
      latitud,
      longitud,
      es_principal
    FROM sucursales
    WHERE id_negocio = ? AND activo = TRUE
    ORDER BY es_principal DESC, fecha_registro ASC
    `,
    [id_negocio]
  );

  return rows;
};

// sucursal.repository.js

export const update = async (id_sucursal, data) => {
  const fields = [];
  const values = [];

  Object.entries(data).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });

  if (fields.length === 0) return;

  await db.query(
    `UPDATE sucursales SET ${fields.join(", ")} WHERE id_sucursal = ?`,
    [...values, id_sucursal]
  );
};
