// negocio.repository.js
import db from "../../config/db.js";

export const createNegocio = async (data) => {
  const [result] = await db.query(
    `
    INSERT INTO negocios (
      id_usuario_propietario,
      nombre,
      tipo,
      descripcion,
      telefono,
      email,
      direccion,
      ciudad
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      data.id_usuario_propietario,
      data.nombre,
      data.tipo,
      data.descripcion,
      data.telefono,
      data.email,
      data.direccion,
      data.ciudad,
    ]
  );

  return result.insertId;
};

export const findByUsuario = async (id_usuario) => { 
  const [rows] = await db.query(
    `SELECT 
        id_negocio,
        nombre,
        tipo,
        descripcion,
        telefono,
        email,
        direccion,
        ciudad,
        verificado,
        activo,
        fecha_registro
     FROM negocios
     WHERE id_usuario_propietario = ?`,
    [id_usuario]
  );

  return rows;
};


export const getNegocioPublicoCompleto = async (id_negocio) => {
  // 1️⃣ Negocio
  const [negocioRows] = await db.query(
    `SELECT 
      id_negocio,
      nombre,
      tipo,
      descripcion,
      telefono,
      email,
      direccion,
      ciudad,
      logo_url,
      banner_url,
      calificacion_promedio,
      total_resenas
     FROM negocios
     WHERE id_negocio = ? AND activo = TRUE`,
    [id_negocio]
  );

  if (!negocioRows.length) return null;

  const negocio = negocioRows[0];

  // 2️⃣ Sucursales
  const [sucursales] = await db.query(
    `SELECT * FROM sucursales 
     WHERE id_negocio = ? AND activo = TRUE`,
    [id_negocio]
  );

  // 3️⃣ Horarios
  const [horarios] = await db.query(
    `SELECT h.*, s.id_sucursal 
     FROM horarios_negocio h
     JOIN sucursales s ON s.id_sucursal = h.id_sucursal
     WHERE s.id_negocio = ?`,
    [id_negocio]
  );

  const sucursalesConHorarios = sucursales.map((s) => ({
    ...s,
    horarios: horarios.filter((h) => h.id_sucursal === s.id_sucursal),
  }));

  // 4️⃣ Servicios (⚠ depende de tu tabla servicios)
  const [servicios] = await db.query(
    `SELECT id_servicio, nombre, precio_base, duracion_minutos
     FROM servicios
     WHERE id_negocio = ? AND activo = TRUE`,
    [id_negocio]
  );

  // 5️⃣ Reseñas recientes (últimas 5)
  const [resenas] = await db.query(
    `SELECT 
        r.id_resena,
        r.calificacion,
        r.comentario,
        r.fecha_creacion,
        u.nombre AS cliente_nombre
     FROM resenas r
     JOIN usuarios u ON u.id_usuario = r.id_usuario
     WHERE r.id_negocio = ?
     ORDER BY r.fecha_creacion DESC
     LIMIT 5`,
    [id_negocio]
  );

  return {
    ...negocio,
    sucursales: sucursalesConHorarios,
    servicios,
    resenas_recientes: resenas,
  };
};


export const updateNegocio = async (id_negocio, data) => {

  const fields = [];
  const values = [];

  for (const key in data) {
    fields.push(`${key} = ?`);
    values.push(data[key]);
  }

  const sql = `
    UPDATE negocios
    SET ${fields.join(", ")}, fecha_actualizacion = NOW()
    WHERE id_negocio = ?
  `;

  values.push(id_negocio);

  await db.query(sql, values);
};

export const findById = async (id_negocio) => {
  const [rows] = await db.query(
    "SELECT * FROM negocios WHERE id_negocio = ?",
    [id_negocio]
  );

  return rows[0];
};

