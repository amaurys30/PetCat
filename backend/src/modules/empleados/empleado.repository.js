import db from "../../config/db.js";

export const findByUserId = async (id_usuario) => {
  const [rows] = await db.query(
    `
    SELECT e.*, r.permisos_json
    FROM empleados e
    JOIN roles r ON e.id_rol = r.id_rol
    WHERE e.id_usuario = ?
    LIMIT 1
    `,
    [id_usuario]
  );

  if (rows.length === 0) return null;

  const empleado = rows[0];

  return {
    ...empleado,
    rol: {
      permisos_json: empleado.permisos_json,
    },
  };
};


export const findById = async (id_empleado) => {
  const [rows] = await db.query(
    `
    SELECT 
      e.*, 
      r.nombre AS rol_nombre,
      r.descripcion AS rol_descripcion,
      r.permisos_json
    FROM empleados e
    INNER JOIN roles r ON e.id_rol = r.id_rol
    WHERE e.id_empleado = ?
    LIMIT 1
    `,
    [id_empleado]
  );

  return rows[0];
};


export const create = async (data) => {
  const {
    id_negocio,
    id_rol,
    id_usuario,
    nombre,
    apellido,
    email,
    telefono,
    documento,
    especialidad,
    titulo_profesional,
    registro_profesional,
    foto_url,
    notas,
    fecha_vinculacion
  } = data;

  const [result] = await db.query(
    `
    INSERT INTO empleados (
      id_negocio, id_rol, id_usuario,
      nombre, apellido, email, telefono,
      documento, especialidad, titulo_profesional,
      registro_profesional, foto_url, notas,
      fecha_vinculacion
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id_negocio,
      id_rol,
      id_usuario || null,
      nombre,
      apellido,
      email || null,
      telefono || null,
      documento || null,
      especialidad || null,
      titulo_profesional || null,
      registro_profesional || null,
      foto_url || null,
      notas || null,
      fecha_vinculacion
    ]
  );

  return result.insertId;
};

export const findByEmail = async (email) => {
  const [rows] = await db.query(
    "SELECT * FROM empleados WHERE email = ?",
    [email]
  );
  return rows[0];
};



export const findAllByNegocio = async (id_negocio) => {
  const [rows] = await db.query(
    `
    SELECT 
      e.id_empleado,
      e.id_negocio,
      e.id_rol,
      r.nombre AS rol_nombre,
      r.descripcion AS rol_descripcion,
      e.id_usuario,
      e.nombre,
      e.apellido,
      e.email,
      e.telefono,
      e.documento,
      e.especialidad,
      e.titulo_profesional,
      e.registro_profesional,
      e.foto_url,
      e.notas,
      e.activo,
      e.fecha_vinculacion,
      e.fecha_retiro,
      e.fecha_creacion,
      e.fecha_actualizacion
    FROM empleados e
    INNER JOIN roles r ON e.id_rol = r.id_rol
    WHERE e.id_negocio = ?
    ORDER BY e.activo DESC, e.fecha_creacion DESC
    `,
    [id_negocio]
  );

  return rows;
};

/**
 * Vínculo de un usuario como empleado de un negocio, con su rol y permisos.
 * Si hubiera más de un registro, se prefiere el activo.
 */
export const findAccesoByUsuarioAndNegocio = async (id_usuario, id_negocio) => {
  const [rows] = await db.query(
    `SELECT e.id_empleado, e.activo, e.id_rol, r.nombre AS rol_nombre, r.permisos_json
     FROM empleados e
     JOIN roles r ON r.id_rol = e.id_rol
     WHERE e.id_usuario = ? AND e.id_negocio = ?
     ORDER BY e.activo DESC, e.id_empleado
     LIMIT 1`,
    [id_usuario, id_negocio]
  );
  return rows[0];
};

export const update = async (id_empleado, data) => {

  const fields = [];
  const values = [];

  for (const key in data) {
    fields.push(`${key} = ?`);
    values.push(data[key]);
  }

  if (fields.length === 0) {
    throw new Error("No hay campos para actualizar");
  }

  values.push(id_empleado);

  await db.query(
    `UPDATE empleados SET ${fields.join(", ")} WHERE id_empleado = ?`,
    values
  );

  return await findById(id_empleado);
};

export const softDelete = async (id_empleado) => {
  await db.query(
    `
    UPDATE empleados
    SET 
      activo = FALSE,
      fecha_retiro = CURDATE()
    WHERE id_empleado = ?
    `,
    [id_empleado]
  );
};


export const reactivar = async (id_empleado) => {
  await db.query(
    `
    UPDATE empleados
    SET
      activo = TRUE,
      fecha_retiro = NULL
    WHERE id_empleado = ?
    `,
    [id_empleado]
  );
};
