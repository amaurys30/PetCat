import db from "../../config/db.js";
import { pick } from "../../shared/utils/pick.js";
import { CAMPOS_MASCOTA } from "./mascota.schemas.js";

// `edad_meses` se calcula con la fecha de hoy de MySQL (zona de Bogotá).
const COLUMNAS = `id_mascota, id_usuario, nombre, especie, raza, color, fecha_nacimiento,
                  TIMESTAMPDIFF(MONTH, fecha_nacimiento, CURDATE()) AS edad_meses,
                  sexo, peso, microchip, numero_registro, codigo_pasaporte, esterilizado, tiene_alergias,
                  alergias_detalle, condiciones_medicas, compartir_historial, tipo_sangre, foto_url,
                  fallecido, fecha_fallecimiento, activo, fecha_registro, fecha_actualizacion`;

/** Mascota por id, activa o no. Con `forUpdate` bloquea la fila. */
export const findById = async (id_mascota, { conn, forUpdate = false } = {}) => {
  const [rows] = await (conn ?? db).query(
    `SELECT ${COLUMNAS} FROM mascotas WHERE id_mascota = ?${forUpdate ? " FOR UPDATE" : ""}`,
    [id_mascota]
  );
  return rows[0];
};

export const setFoto = async (id_mascota, foto_url, conn) => {
  await (conn ?? db).query("UPDATE mascotas SET foto_url = ? WHERE id_mascota = ?", [foto_url, id_mascota]);
};

/** Mascotas activas (no borradas) del usuario: vivas primero, luego por nombre. */
export const findActivasByUsuario = async (id_usuario) => {
  const [rows] = await db.query(
    `SELECT ${COLUMNAS} FROM mascotas
     WHERE id_usuario = ? AND activo = TRUE
     ORDER BY fallecido, nombre, id_mascota`,
    [id_usuario]
  );
  return rows;
};

export const create = async (id_usuario, data, conn) => {
  const campos = { ...pick(data, CAMPOS_MASCOTA), id_usuario };
  const columnas = Object.keys(campos);
  const [result] = await (conn ?? db).query(
    `INSERT INTO mascotas (${columnas.join(", ")}) VALUES (${columnas.map(() => "?").join(", ")})`,
    Object.values(campos)
  );
  return result.insertId;
};

export const update = async (id_mascota, data, conn) => {
  const campos = pick(data, CAMPOS_MASCOTA);
  const columnas = Object.keys(campos);
  if (columnas.length === 0) return;
  await (conn ?? db).query(
    `UPDATE mascotas SET ${columnas.map((c) => `${c} = ?`).join(", ")} WHERE id_mascota = ?`,
    [...Object.values(campos), id_mascota]
  );
};

/** Borrado lógico: la mascota conserva su historial y sus citas. */
export const softDelete = async (id_mascota, conn) => {
  await (conn ?? db).query("UPDATE mascotas SET activo = FALSE WHERE id_mascota = ?", [id_mascota]);
};

/** Citas pendientes o confirmadas de la mascota desde este momento. */
export const countCitasFuturasActivas = async (id_mascota, conn) => {
  const [[row]] = await (conn ?? db).query(
    `SELECT COUNT(*) AS total
     FROM citas
     WHERE id_mascota = ?
       AND estado IN ('pendiente', 'confirmada')
       AND (fecha > CURDATE() OR (fecha = CURDATE() AND hora_inicio >= CURTIME()))`,
    [id_mascota]
  );
  return row.total;
};
