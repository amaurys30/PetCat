import db from "../../config/db.js";

// Nota con su autor (NULL si su cuenta ya no existe).
const SELECT_NOTA = `
  SELECT n.id_nota, n.id_negocio, n.id_usuario, n.id_usuario_autor, n.texto, n.fecha_creacion, n.fecha_edicion,
         a.nombre AS autor_nombre, a.apellido AS autor_apellido
  FROM notas_cliente n
  LEFT JOIN usuarios a ON a.id_usuario = n.id_usuario_autor`;

export const findById = async (id_nota) => {
  const [rows] = await db.query(`${SELECT_NOTA} WHERE n.id_nota = ?`, [id_nota]);
  return rows[0];
};

/** Notas del cliente en el negocio, las más recientes primero. */
export const findPage = async (id_negocio, id_usuario, { limit, offset }) => {
  const [rows] = await db.query(
    `${SELECT_NOTA} WHERE n.id_negocio = ? AND n.id_usuario = ?
     ORDER BY n.fecha_creacion DESC, n.id_nota DESC LIMIT ? OFFSET ?`,
    [id_negocio, id_usuario, limit, offset]
  );
  const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM notas_cliente WHERE id_negocio = ? AND id_usuario = ?", [
    id_negocio,
    id_usuario,
  ]);
  return { rows, total };
};

export const create = async ({ id_negocio, id_usuario, id_usuario_autor, texto }) => {
  const [result] = await db.query(
    "INSERT INTO notas_cliente (id_negocio, id_usuario, id_usuario_autor, texto) VALUES (?, ?, ?, ?)",
    [id_negocio, id_usuario, id_usuario_autor, texto]
  );
  return result.insertId;
};

export const updateTexto = async (id_nota, texto) => {
  await db.query("UPDATE notas_cliente SET texto = ?, fecha_edicion = NOW() WHERE id_nota = ?", [texto, id_nota]);
};

/** Borrado físico (excepción a la convención: el dato personal desaparece). */
export const remove = async (id_nota) => {
  await db.query("DELETE FROM notas_cliente WHERE id_nota = ?", [id_nota]);
};
