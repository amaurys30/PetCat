import db from "../../config/db.js";

/**
 * `token` guarda el SHA-256 del token del enlace, nunca el token en claro.
 * Una invitación está vigente si no se usó y `expiracion > NOW()`; invalidarla
 * es poner `expiracion = NOW()`.
 */

/** Crea la invitación con vigencia de `horas` (reloj de MySQL) y devuelve id y expiración. */
export const create = async ({ id_empleado, id_negocio, email, token_hash, intentos_reenvio, horas }, conn) => {
  const [result] = await (conn ?? db).query(
    `INSERT INTO invitaciones_empleado (id_empleado, id_negocio, email, token, expiracion, intentos_reenvio)
     VALUES (?, ?, ?, ?, NOW() + INTERVAL ? HOUR, ?)`,
    [id_empleado, id_negocio, email, token_hash, horas, intentos_reenvio]
  );
  const [[row]] = await (conn ?? db).query(
    "SELECT id_invitacion, email, expiracion FROM invitaciones_empleado WHERE id_invitacion = ?",
    [result.insertId]
  );
  return row;
};

export const findVigenteByEmpleado = async (id_empleado, conn) => {
  const [rows] = await (conn ?? db).query(
    `SELECT id_invitacion, email, expiracion FROM invitaciones_empleado
     WHERE id_empleado = ? AND usado = FALSE AND expiracion > NOW()
     ORDER BY id_invitacion DESC LIMIT 1`,
    [id_empleado]
  );
  return rows[0];
};

/** true si el empleado ya recibió alguna invitación en ese email. */
export const existsByEmpleadoAndEmail = async (id_empleado, email, conn) => {
  const [rows] = await (conn ?? db).query(
    "SELECT 1 FROM invitaciones_empleado WHERE id_empleado = ? AND email = ? LIMIT 1",
    [id_empleado, email]
  );
  return rows.length > 0;
};

/**
 * Invitaciones enviadas a un email en un negocio en las últimas `horas`, y desde
 * cuándo se libera un cupo (la más antigua de la ventana + `horas`).
 */
export const countRecientesByEmail = async (id_negocio, email, horas, conn) => {
  const [[row]] = await (conn ?? db).query(
    `SELECT COUNT(*) AS total,
            DATE_FORMAT(MIN(fecha_creacion) + INTERVAL ? HOUR, '%Y-%m-%d %H:%i') AS libre_desde
     FROM invitaciones_empleado
     WHERE id_negocio = ? AND email = ? AND fecha_creacion > NOW() - INTERVAL ? HOUR`,
    [horas, id_negocio, email, horas]
  );
  return row;
};

/**
 * Estado de las invitaciones de varios empleados (listado del panel), por id_empleado:
 * expiración de la vigente (o null), correos enviados a su email actual en el negocio en las
 * últimas `horas` y desde cuándo se libera un cupo.
 */
export const findEstadoDeEmpleados = async (ids, horas) => {
  if (ids.length === 0) return {};
  const [rows] = await db.query(
    `SELECT e.id_empleado,
            (SELECT MAX(i.expiracion) FROM invitaciones_empleado i
             WHERE i.id_empleado = e.id_empleado AND i.usado = FALSE AND i.expiracion > NOW()) AS expiracion,
            COUNT(r.id_invitacion) AS enviadas,
            DATE_FORMAT(MIN(r.fecha_creacion) + INTERVAL ? HOUR, '%Y-%m-%d %H:%i') AS libre_desde
     FROM empleados e
     LEFT JOIN invitaciones_empleado r
       ON r.id_negocio = e.id_negocio AND r.email = e.email AND r.fecha_creacion > NOW() - INTERVAL ? HOUR
     WHERE e.id_empleado IN (?)
     GROUP BY e.id_empleado`,
    [horas, horas, ids]
  );
  return Object.fromEntries(rows.map((row) => [row.id_empleado, row]));
};

/**
 * Invitación por el hash del token, con los datos del empleado, su rol y el
 * negocio. Con `forUpdate` bloquea la invitación y el empleado hasta el fin de
 * la transacción (aceptar).
 */
export const findByTokenHash = async (token_hash, { conn, forUpdate = false } = {}) => {
  const [rows] = await (conn ?? db).query(
    `SELECT i.id_invitacion, i.id_empleado, i.id_negocio, i.email, i.expiracion, i.usado,
            (i.expiracion > NOW()) AS vigente,
            e.nombre AS empleado_nombre, e.apellido AS empleado_apellido, e.email AS empleado_email,
            e.activo AS empleado_activo, e.id_usuario AS empleado_id_usuario,
            r.nombre AS rol_nombre,
            n.nombre AS negocio_nombre, n.logo_url AS negocio_logo_url, n.activo AS negocio_activo
     FROM invitaciones_empleado i
     JOIN empleados e ON e.id_empleado = i.id_empleado
     JOIN roles r ON r.id_rol = e.id_rol
     JOIN negocios n ON n.id_negocio = i.id_negocio
     WHERE i.token = ?
     ${forUpdate ? "FOR UPDATE OF i, e" : ""}`,
    [token_hash]
  );
  return rows[0];
};

/**
 * Invalida las invitaciones pendientes del empleado. Acepta conn para usarse en transacciones
 * (con el empleado ya bloqueado). Actualiza por clave primaria, no por id_empleado: la misma
 * transacción inserta después la invitación nueva (regla de bloqueos de la Fase 1).
 */
export const invalidatePrevious = async (id_empleado, conn) => {
  const [vigentes] = await (conn ?? db).query(
    "SELECT id_invitacion FROM invitaciones_empleado WHERE id_empleado = ? AND usado = FALSE AND expiracion > NOW()",
    [id_empleado]
  );
  if (vigentes.length === 0) return;
  await (conn ?? db).query("UPDATE invitaciones_empleado SET expiracion = NOW() WHERE id_invitacion IN (?)", [
    vigentes.map((i) => i.id_invitacion),
  ]);
};

export const markAsUsed = async (id_invitacion, conn) => {
  await (conn ?? db).query(
    "UPDATE invitaciones_empleado SET usado = TRUE, fecha_usado = NOW() WHERE id_invitacion = ?",
    [id_invitacion]
  );
};
