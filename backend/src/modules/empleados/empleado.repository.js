import db from "../../config/db.js";
import { pick } from "../../shared/utils/pick.js";
import { likeLiteral } from "../../shared/utils/sql.js";
import { CAMPOS_EMPLEADO } from "./empleado.schemas.js";

const SELECT_EMPLEADO = `
  SELECT e.id_empleado, e.id_negocio, e.id_usuario, e.nombre, e.apellido, e.email, e.telefono,
         e.documento, e.especialidad, e.titulo_profesional, e.registro_profesional, e.foto_url,
         e.notas, e.activo, e.fecha_vinculacion, e.fecha_retiro, e.fecha_creacion,
         e.fecha_actualizacion,
         r.id_rol, r.nombre AS rol_nombre, r.permisos_json,
         EXISTS (SELECT 1 FROM invitaciones_empleado i
                 WHERE i.id_empleado = e.id_empleado AND i.usado = FALSE AND i.expiracion > NOW())
           AS invitacion_pendiente,
         (e.id_usuario IS NOT NULL AND e.id_usuario = n.id_usuario_propietario) AS es_propietario
  FROM empleados e
  JOIN roles r ON r.id_rol = e.id_rol
  JOIN negocios n ON n.id_negocio = e.id_negocio`;

/** Con `forUpdate` (dentro de una transacción) bloquea la fila del empleado. */
export const findById = async (id_empleado, conn, { forUpdate = false } = {}) => {
  const [rows] = await (conn ?? db).query(
    `${SELECT_EMPLEADO} WHERE e.id_empleado = ? ${forUpdate ? "FOR UPDATE OF e" : ""}`,
    [id_empleado]
  );
  return rows[0];
};

/**
 * Página de empleados del negocio con filtros opcionales:
 * `activo` (true/false) y `q` (nombre, apellido, nombre completo, email o documento).
 */
export const findPageByNegocio = async (id_negocio, { activo, q, limit, offset }) => {
  const condiciones = ["e.id_negocio = ?"];
  const valores = [id_negocio];
  if (activo !== undefined) {
    condiciones.push("e.activo = ?");
    valores.push(activo);
  }
  if (q) {
    condiciones.push(
      "(e.nombre LIKE ? OR e.apellido LIKE ? OR CONCAT(e.nombre, ' ', e.apellido) LIKE ? OR e.email LIKE ? OR e.documento LIKE ?)"
    );
    valores.push(...Array(5).fill(likeLiteral(q)));
  }
  const where = `WHERE ${condiciones.join(" AND ")}`;

  const [rows] = await db.query(
    `${SELECT_EMPLEADO} ${where}
     ORDER BY e.activo DESC, e.apellido, e.nombre, e.id_empleado
     LIMIT ? OFFSET ?`,
    [...valores, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM empleados e ${where}`, valores);
  return { rows, total };
};

/** Empleados activos del negocio para la agenda: solo datos de presentación. */
export const findProfesionales = async (id_negocio) => {
  const [rows] = await db.query(
    `SELECT e.id_empleado, e.nombre, e.apellido, e.especialidad, e.foto_url, r.id_rol, r.nombre AS rol_nombre
     FROM empleados e
     JOIN roles r ON r.id_rol = e.id_rol
     WHERE e.id_negocio = ? AND e.activo = TRUE
     ORDER BY e.nombre, e.apellido, e.id_empleado`,
    [id_negocio]
  );
  return rows;
};

/** Empleado del negocio con ese email (sin distinguir mayúsculas), excepto `excluirId`. */
export const findByEmailInNegocio = async (id_negocio, email, excluirId = 0, conn) => {
  const [rows] = await (conn ?? db).query(
    "SELECT id_empleado, activo, id_usuario FROM empleados WHERE id_negocio = ? AND email = ? AND id_empleado <> ? LIMIT 1",
    [id_negocio, email, excluirId]
  );
  return rows[0];
};

/** Crea el empleado; sin fecha_vinculacion se usa la fecha de hoy. */
export const create = async (id_negocio, data, conn) => {
  const { fecha_vinculacion = null, ...resto } = pick(data, CAMPOS_EMPLEADO);
  const campos = { ...resto, id_negocio };
  const columnas = Object.keys(campos);
  const [result] = await (conn ?? db).query(
    `INSERT INTO empleados (${columnas.join(", ")}, fecha_vinculacion)
     VALUES (${columnas.map(() => "?").join(", ")}, COALESCE(?, CURDATE()))`,
    [...Object.values(campos), fecha_vinculacion]
  );
  return result.insertId;
};

export const update = async (id_empleado, data, conn) => {
  const campos = pick(data, CAMPOS_EMPLEADO);
  const columnas = Object.keys(campos);
  if (columnas.length === 0) return;
  await (conn ?? db).query(
    `UPDATE empleados SET ${columnas.map((c) => `${c} = ?`).join(", ")} WHERE id_empleado = ?`,
    [...Object.values(campos), id_empleado]
  );
};

export const desactivar = async (id_empleado, conn) => {
  await (conn ?? db).query(
    "UPDATE empleados SET activo = FALSE, fecha_retiro = CURDATE() WHERE id_empleado = ?",
    [id_empleado]
  );
};

export const setFoto = async (id_empleado, foto_url, conn) => {
  await (conn ?? db).query("UPDATE empleados SET foto_url = ? WHERE id_empleado = ?", [foto_url, id_empleado]);
};

export const reactivar = async (id_empleado, conn) => {
  await (conn ?? db).query(
    "UPDATE empleados SET activo = TRUE, fecha_retiro = NULL WHERE id_empleado = ?",
    [id_empleado]
  );
};

/**
 * Vincula la cuenta de un usuario al empleado (flujo de invitaciones). La base
 * impide vincular el mismo usuario dos veces al mismo negocio (UNIQUE, 409).
 */
export const linkUsuario = async (id_empleado, id_usuario, conn) => {
  await (conn ?? db).query("UPDATE empleados SET id_usuario = ? WHERE id_empleado = ?", [id_usuario, id_empleado]);
};

/**
 * Vínculo de un usuario como empleado de un negocio, con su rol y permisos
 * (lo usa authorize). La base garantiza un solo registro por usuario y negocio.
 */
export const findAccesoByUsuarioAndNegocio = async (id_usuario, id_negocio, conn) => {
  const [rows] = await (conn ?? db).query(
    `SELECT e.id_empleado, e.activo, e.id_rol, r.nombre AS rol_nombre, r.permisos_json
     FROM empleados e
     JOIN roles r ON r.id_rol = e.id_rol
     WHERE e.id_usuario = ? AND e.id_negocio = ?
     LIMIT 1`,
    [id_usuario, id_negocio]
  );
  return rows[0];
};
