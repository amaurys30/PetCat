import db from "../../config/db.js";

const COLUMNAS = `id_archivo, public_id, tipo_recurso, entrega, formato, bytes, ancho, alto, nombre_original,
  entidad, id_entidad, estado, intentos_eliminar, id_usuario_subio, fecha_creacion`;

export const create = async (fila, conn) => {
  const [result] = await (conn ?? db).query(
    `INSERT INTO archivos (public_id, tipo_recurso, entrega, formato, bytes, ancho, alto, nombre_original,
                           entidad, id_entidad, estado, id_usuario_subio)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fila.public_id,
      fila.tipo_recurso,
      fila.entrega,
      fila.formato,
      fila.bytes,
      fila.ancho ?? null,
      fila.alto ?? null,
      fila.nombre_original ?? null,
      fila.entidad,
      fila.id_entidad,
      fila.estado ?? "activo",
      fila.id_usuario_subio ?? null,
    ]
  );
  return result.insertId;
};

export const findById = async (id_archivo, conn) => {
  const [rows] = await (conn ?? db).query(`SELECT ${COLUMNAS} FROM archivos WHERE id_archivo = ?`, [id_archivo]);
  return rows[0];
};

/** Archivos activos de un registro (p. ej. los del historial id 5), del más antiguo al más reciente. */
export const findActivos = async (entidad, id_entidad, conn) => {
  const [rows] = await (conn ?? db).query(
    `SELECT ${COLUMNAS} FROM archivos WHERE entidad = ? AND id_entidad = ? AND estado = 'activo' ORDER BY id_archivo`,
    [entidad, id_entidad]
  );
  return rows;
};

/** Archivos activos de varios registros de la misma entidad, agrupados por id_entidad. */
export const findActivosDeEntidades = async (entidad, ids, conn) => {
  if (ids.length === 0) return {};
  const [rows] = await (conn ?? db).query(
    `SELECT ${COLUMNAS} FROM archivos WHERE entidad = ? AND id_entidad IN (?) AND estado = 'activo' ORDER BY id_archivo`,
    [entidad, ids]
  );
  const porEntidad = {};
  for (const row of rows) (porEntidad[row.id_entidad] ??= []).push(row);
  return porEntidad;
};

/**
 * Pasa a `por_eliminar` los archivos activos del registro (todos, o solo `ids`, o todos
 * menos `excepto`) y los devuelve. Se borran de Cloudinary después del commit.
 * La transacción ya bloqueó el registro dueño (mascota, vacuna...): eso serializa los
 * cambios de sus archivos, así que aquí se lee sin FOR UPDATE (bloquear por el índice
 * secundario que el mismo UPDATE modifica puede terminar en deadlock) y se actualiza por id.
 */
export const marcarPorEliminar = async ({ entidad, id_entidad, ids, excepto = [], id_usuario }, conn) => {
  const filtros = ["entidad = ?", "id_entidad = ?", "estado = 'activo'"];
  const params = [entidad, id_entidad];
  if (ids) {
    if (ids.length === 0) return [];
    filtros.push("id_archivo IN (?)");
    params.push(ids);
  }
  if (excepto.length > 0) {
    filtros.push("id_archivo NOT IN (?)");
    params.push(excepto);
  }
  const [rows] = await conn.query(`SELECT ${COLUMNAS} FROM archivos WHERE ${filtros.join(" AND ")}`, params);
  if (rows.length === 0) return [];
  await conn.query(
    `UPDATE archivos SET estado = 'por_eliminar', fecha_eliminacion = NOW(), id_usuario_elimino = ?
     WHERE id_archivo IN (?)`,
    [id_usuario ?? null, rows.map((r) => r.id_archivo)]
  );
  return rows;
};

export const marcarEliminado = async (id_archivo) => {
  await db.query("UPDATE archivos SET estado = 'eliminado' WHERE id_archivo = ?", [id_archivo]);
};

export const sumarIntentoEliminar = async (id_archivo) => {
  await db.query(
    "UPDATE archivos SET intentos_eliminar = LEAST(intentos_eliminar + 1, 255) WHERE id_archivo = ?",
    [id_archivo]
  );
};

/** Pendientes de borrar en Cloudinary (para reintentar), los más antiguos primero. */
export const findPorEliminar = async ({ limite, maxIntentos }) => {
  const [rows] = await db.query(
    `SELECT ${COLUMNAS} FROM archivos
     WHERE estado = 'por_eliminar' AND intentos_eliminar < ?
     ORDER BY id_archivo LIMIT ?`,
    [maxIntentos, limite]
  );
  return rows;
};
