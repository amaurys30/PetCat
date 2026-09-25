import db from "../../config/db.js";
import { pick } from "../../shared/utils/pick.js";
import { CAMPOS_SUCURSAL } from "./sucursal.schemas.js";

const COLUMNAS = `id_sucursal, id_negocio, nombre, descripcion, telefono, direccion, ciudad,
                  latitud, longitud, es_principal, activo, fecha_registro`;

export const findById = async (id_sucursal, conn) => {
  const [rows] = await (conn ?? db).query(`SELECT ${COLUMNAS} FROM sucursales WHERE id_sucursal = ?`, [id_sucursal]);
  return rows[0];
};

/** Sucursal activa de un negocio activo (vista pública). */
export const findPublicaById = async (id_sucursal) => {
  const [rows] = await db.query(
    `SELECT s.id_sucursal, s.id_negocio, s.nombre, s.descripcion, s.telefono, s.direccion, s.ciudad,
            s.latitud, s.longitud, s.es_principal
     FROM sucursales s
     JOIN negocios n ON n.id_negocio = s.id_negocio
     WHERE s.id_sucursal = ? AND s.activo = TRUE AND n.activo = TRUE`,
    [id_sucursal]
  );
  return rows[0];
};

export const findActivasByNegocio = async (id_negocio) => {
  const [rows] = await db.query(
    `SELECT id_sucursal, id_negocio, nombre, descripcion, telefono, direccion, ciudad,
            latitud, longitud, es_principal
     FROM sucursales
     WHERE id_negocio = ? AND activo = TRUE
     ORDER BY es_principal DESC, id_sucursal`,
    [id_negocio]
  );
  return rows;
};

/**
 * Bloquea las sucursales activas del negocio hasta el fin de la transacción:
 * serializa los cambios de sucursal principal entre peticiones simultáneas.
 */
export const lockActivasByNegocio = async (id_negocio, conn) => {
  const [rows] = await conn.query(
    "SELECT id_sucursal, es_principal FROM sucursales WHERE id_negocio = ? AND activo = TRUE FOR UPDATE",
    [id_negocio]
  );
  return rows;
};

export const create = async (id_negocio, data, conn) => {
  const campos = { ...pick(data, CAMPOS_SUCURSAL), id_negocio };
  const columnas = Object.keys(campos);
  const [result] = await (conn ?? db).query(
    `INSERT INTO sucursales (${columnas.join(", ")}) VALUES (${columnas.map(() => "?").join(", ")})`,
    Object.values(campos)
  );
  return result.insertId;
};

export const update = async (id_sucursal, data, conn) => {
  const campos = pick(data, CAMPOS_SUCURSAL);
  const columnas = Object.keys(campos);
  if (columnas.length === 0) return;
  await (conn ?? db).query(
    `UPDATE sucursales SET ${columnas.map((c) => `${c} = ?`).join(", ")} WHERE id_sucursal = ?`,
    [...Object.values(campos), id_sucursal]
  );
};

export const clearPrincipal = async (id_negocio, conn) => {
  await (conn ?? db).query("UPDATE sucursales SET es_principal = FALSE WHERE id_negocio = ?", [id_negocio]);
};

/** Borrado lógico: una sucursal inactiva nunca queda como principal. */
export const softDelete = async (id_sucursal, conn) => {
  await (conn ?? db).query(
    "UPDATE sucursales SET activo = FALSE, es_principal = FALSE WHERE id_sucursal = ?",
    [id_sucursal]
  );
};

/** Citas pendientes o confirmadas de la sucursal desde este momento. */
export const countCitasFuturasActivas = async (id_sucursal, conn) => {
  const [[row]] = await (conn ?? db).query(
    `SELECT COUNT(*) AS total
     FROM citas
     WHERE id_sucursal = ?
       AND estado IN ('pendiente', 'confirmada')
       AND (fecha > CURDATE() OR (fecha = CURDATE() AND hora_inicio >= CURTIME()))`,
    [id_sucursal]
  );
  return row.total;
};
