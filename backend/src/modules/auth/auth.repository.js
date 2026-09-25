import pool from "../../config/db.js";

/**
 * Buscar usuario por email
 */
export const findUserByEmail = async (email) => {
  const [rows] = await pool.query(
    `SELECT * FROM usuarios WHERE email = ? LIMIT 1`,
    [email]
  );
  return rows[0];
};

/**
 * Crear usuario (alineado a tu tabla real)
 */
export const createUser = async (user) => {
  const {
    nombre,
    apellido,
    email,
    password_hash,
    tipo_usuario = "cliente",
    telefono = null
  } = user;

  const [result] = await pool.query(
    `INSERT INTO usuarios 
    (nombre, apellido, email, password_hash, tipo_usuario, telefono)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [nombre, apellido, email, password_hash, tipo_usuario, telefono]
  );

  return {
    id_usuario: result.insertId,
    nombre,
    apellido,
    email,
    tipo_usuario
  };
};