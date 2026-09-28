import db from "../../config/db.js";
import { pick } from "../../shared/utils/pick.js";

// Horas en HH:MM (sin segundos), como en los horarios de sucursal.
const COLUMNAS = `d.id_disponibilidad, d.id_empleado, d.id_sucursal, d.tipo, d.dia_semana,
  d.fecha_especifica, d.fecha_fin,
  TIME_FORMAT(d.hora_inicio, '%H:%i') AS hora_inicio, TIME_FORMAT(d.hora_fin, '%H:%i') AS hora_fin,
  d.motivo, d.activo`;

const COLUMNAS_ESCRIBIBLES = ["tipo", "dia_semana", "fecha_especifica", "fecha_fin", "hora_inicio", "hora_fin", "id_sucursal", "motivo"];

/**
 * Bloquea la fila del empleado: serializa los cambios de su disponibilidad (y,
 * en 1.5, sus reservas). Devuelve id_empleado, id_negocio y activo.
 */
export const lockEmpleado = async (id_empleado, conn) => {
  const [rows] = await conn.query(
    "SELECT id_empleado, id_negocio, activo FROM empleados WHERE id_empleado = ? FOR UPDATE",
    [id_empleado]
  );
  return rows[0];
};

export const findEmpleado = async (id_empleado, conn) => {
  const [rows] = await (conn ?? db).query("SELECT id_empleado, id_negocio, activo FROM empleados WHERE id_empleado = ?", [
    id_empleado,
  ]);
  return rows[0];
};

/** Registro por id con el negocio del empleado. */
export const findById = async (id_disponibilidad, conn) => {
  const [rows] = await (conn ?? db).query(
    `SELECT ${COLUMNAS}, e.id_negocio
     FROM disponibilidad_empleado d
     JOIN empleados e ON e.id_empleado = d.id_empleado
     WHERE d.id_disponibilidad = ?`,
    [id_disponibilidad]
  );
  return rows[0];
};

/** `horario_normal` activo del empleado, por día y hora. */
export const findHorarioSemanal = async (id_empleado, conn) => {
  const [rows] = await (conn ?? db).query(
    `SELECT ${COLUMNAS} FROM disponibilidad_empleado d
     WHERE d.id_empleado = ? AND d.tipo = 'horario_normal' AND d.activo = TRUE
     ORDER BY d.dia_semana, d.hora_inicio, d.id_disponibilidad`,
    [id_empleado]
  );
  return rows;
};

/**
 * Excepciones activas (bloqueo, vacación, evento especial) que tocan el período
 * [desde, hasta]; sin `hasta`, todas desde `desde`. `excluirId` deja fuera un registro.
 */
export const findExcepciones = async (id_empleado, { desde, hasta, tipo, excluirId = 0 } = {}, conn) => {
  const condiciones = ["d.id_empleado = ?", "d.tipo <> 'horario_normal'", "d.activo = TRUE", "d.id_disponibilidad <> ?"];
  const valores = [id_empleado, excluirId];
  if (desde) {
    condiciones.push("COALESCE(d.fecha_fin, d.fecha_especifica) >= ?");
    valores.push(desde);
  }
  if (hasta) {
    condiciones.push("d.fecha_especifica <= ?");
    valores.push(hasta);
  }
  if (tipo) {
    condiciones.push("d.tipo = ?");
    valores.push(tipo);
  }
  const [rows] = await (conn ?? db).query(
    `SELECT ${COLUMNAS} FROM disponibilidad_empleado d
     WHERE ${condiciones.join(" AND ")}
     ORDER BY d.fecha_especifica, d.hora_inicio, d.id_disponibilidad`,
    valores
  );
  return rows;
};

/** Reemplaza el `horario_normal` del empleado. Usar dentro de una transacción. */
export const replaceHorarioSemanal = async (id_empleado, rangos, conn) => {
  await conn.query("DELETE FROM disponibilidad_empleado WHERE id_empleado = ? AND tipo = 'horario_normal'", [id_empleado]);
  if (rangos.length === 0) return;
  await conn.query(
    `INSERT INTO disponibilidad_empleado (id_empleado, tipo, dia_semana, hora_inicio, hora_fin, id_sucursal)
     VALUES ?`,
    [rangos.map((r) => [id_empleado, "horario_normal", r.dia_semana, r.hora_inicio, r.hora_fin, r.id_sucursal])]
  );
};

export const create = async (id_empleado, data, conn) => {
  const campos = { ...pick(data, COLUMNAS_ESCRIBIBLES), id_empleado };
  const columnas = Object.keys(campos);
  const [result] = await (conn ?? db).query(
    `INSERT INTO disponibilidad_empleado (${columnas.join(", ")}) VALUES (${columnas.map(() => "?").join(", ")})`,
    Object.values(campos)
  );
  return result.insertId;
};

/** Actualiza con la lista blanca (el tipo no cambia). */
export const update = async (id_disponibilidad, data, conn) => {
  const campos = pick(data, COLUMNAS_ESCRIBIBLES.filter((c) => c !== "tipo"));
  const columnas = Object.keys(campos);
  if (columnas.length === 0) return;
  await (conn ?? db).query(
    `UPDATE disponibilidad_empleado SET ${columnas.map((c) => `${c} = ?`).join(", ")} WHERE id_disponibilidad = ?`,
    [...Object.values(campos), id_disponibilidad]
  );
};

export const softDelete = async (id_disponibilidad, conn) => {
  await (conn ?? db).query("UPDATE disponibilidad_empleado SET activo = FALSE WHERE id_disponibilidad = ?", [
    id_disponibilidad,
  ]);
};

/** Sucursales activas del negocio con su nombre. */
export const findSucursalesActivas = async (id_negocio, conn) => {
  const [rows] = await (conn ?? db).query(
    `SELECT id_sucursal, nombre FROM sucursales
     WHERE id_negocio = ? AND activo = TRUE
     ORDER BY es_principal DESC, id_sucursal`,
    [id_negocio]
  );
  return rows;
};

/** Horarios de las sucursales activas del negocio: { [id_sucursal]: [{ dia_semana, hora_apertura, hora_cierre }] }. */
export const findHorariosSucursales = async (id_negocio, conn) => {
  const [rows] = await (conn ?? db).query(
    `SELECT h.id_sucursal, h.dia_semana,
            TIME_FORMAT(h.hora_apertura, '%H:%i') AS hora_apertura, TIME_FORMAT(h.hora_cierre, '%H:%i') AS hora_cierre
     FROM horarios_negocio h
     JOIN sucursales s ON s.id_sucursal = h.id_sucursal
     WHERE s.id_negocio = ? AND s.activo = TRUE AND h.activo = TRUE`,
    [id_negocio]
  );
  const porSucursal = {};
  for (const { id_sucursal, ...rango } of rows) (porSucursal[id_sucursal] ??= []).push(rango);
  return porSucursal;
};

/**
 * Citas pendientes o confirmadas del empleado desde este momento, con los datos
 * que necesita el panel para reprogramarlas o reasignarlas.
 */
export const findCitasFuturasActivas = async (id_empleado, conn) => findCitasFuturas({ id_empleado }, conn);

/** Como findCitasFuturasActivas, de una sucursal (todas sus citas, de cualquier empleado). */
export const findCitasFuturasActivasDeSucursal = async (id_sucursal, conn) => findCitasFuturas({ id_sucursal }, conn);

const findCitasFuturas = async ({ id_empleado, id_sucursal }, conn) => {
  const [columna, valor] = id_empleado !== undefined ? ["c.id_empleado", id_empleado] : ["c.id_sucursal", id_sucursal];
  const [rows] = await (conn ?? db).query(
    `SELECT c.id_cita, c.fecha, c.id_empleado,
            TIME_FORMAT(c.hora_inicio, '%H:%i') AS hora_inicio, TIME_FORMAT(c.hora_fin, '%H:%i') AS hora_fin,
            c.estado, c.id_sucursal, su.nombre AS sucursal_nombre,
            sv.id_servicio, sv.nombre AS servicio_nombre,
            m.id_mascota, m.nombre AS mascota_nombre,
            u.id_usuario, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.telefono AS cliente_telefono
     FROM citas c
     LEFT JOIN sucursales su ON su.id_sucursal = c.id_sucursal
     JOIN servicios sv ON sv.id_servicio = c.id_servicio
     JOIN mascotas m ON m.id_mascota = c.id_mascota
     JOIN usuarios u ON u.id_usuario = c.id_usuario
     WHERE ${columna} = ?
       AND c.estado IN ('pendiente', 'confirmada')
       AND (c.fecha > CURDATE() OR (c.fecha = CURDATE() AND c.hora_inicio >= CURTIME()))
     ORDER BY c.fecha, c.hora_inicio, c.id_cita`,
    [valor]
  );
  return rows;
};

// ---------- En lote (agenda de varios empleados) ----------

const agruparPorEmpleado = (rows) => {
  const porEmpleado = {};
  for (const row of rows) (porEmpleado[row.id_empleado] ??= []).push(row);
  return porEmpleado;
};

/** `horario_normal` activo de varios empleados: { [id_empleado]: [rango] }. */
export const findHorarioSemanalDeEmpleados = async (ids, conn) => {
  if (ids.length === 0) return {};
  const [rows] = await (conn ?? db).query(
    `SELECT ${COLUMNAS} FROM disponibilidad_empleado d
     WHERE d.id_empleado IN (?) AND d.tipo = 'horario_normal' AND d.activo = TRUE`,
    [ids]
  );
  return agruparPorEmpleado(rows);
};

/** Excepciones activas de varios empleados que tocan [desde, hasta]: { [id_empleado]: [excepcion] }. */
export const findExcepcionesDeEmpleados = async (ids, desde, hasta, conn) => {
  if (ids.length === 0) return {};
  const [rows] = await (conn ?? db).query(
    `SELECT ${COLUMNAS} FROM disponibilidad_empleado d
     WHERE d.id_empleado IN (?) AND d.tipo <> 'horario_normal' AND d.activo = TRUE
       AND COALESCE(d.fecha_fin, d.fecha_especifica) >= ? AND d.fecha_especifica <= ?`,
    [ids, desde, hasta]
  );
  return agruparPorEmpleado(rows);
};
