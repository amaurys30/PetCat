import db from "../../config/db.js";

// usuario.repository.js
export const findById = async (id_usuario) => {
  const [rows] = await db.query(
    "SELECT * FROM usuarios WHERE id_usuario = ?",
    [id_usuario]
  );
  return rows[0];
};


/**
 * 🔍 Buscar usuario por email
 */
export const findByEmail = async (email) => {
  const [rows] = await db.query(
    "SELECT * FROM usuarios WHERE email = ?",
    [email]
  );
  return rows[0];
};


/**
 * ➕ Crear usuario
 */
export const create = async (data) => {
  const {
    nombre,
    apellido,
    email,
    password_hash
  } = data;

  const [result] = await db.query(
    `
    INSERT INTO usuarios (
      nombre,
      apellido,
      email,
      password_hash
    )
    VALUES (?, ?, ?, ?)
    `,
    [nombre, apellido, email, password_hash]
  );

  return result.insertId;
};

