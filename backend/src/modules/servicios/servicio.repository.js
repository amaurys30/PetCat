import db from "../../config/db.js";
import { pick } from "../../shared/utils/pick.js";
import { likeLiteral } from "../../shared/utils/sql.js";
import { CAMPOS_SERVICIO } from "./servicio.schemas.js";

// ---------- Fragmentos SQL (alias `s` = servicios) ----------

/** La oferta aplica hoy: en_oferta, con precio y dentro de sus fechas (si las tiene). */
export const SQL_OFERTA_VIGENTE = `(s.en_oferta = TRUE AND s.precio_oferta IS NOT NULL
  AND (s.fecha_inicio_oferta IS NULL OR s.fecha_inicio_oferta <= CURDATE())
  AND (s.fecha_fin_oferta IS NULL OR s.fecha_fin_oferta >= CURDATE()))`;

/** Precio que se cobra hoy: el de oferta si está vigente; si no, precio_base. */
export const SQL_PRECIO_ACTUAL = `IF(${SQL_OFERTA_VIGENTE}, s.precio_oferta, s.precio_base)`;

/** Hay al menos un empleado activo asignado. */
export const SQL_CON_EMPLEADOS = `EXISTS (
  SELECT 1 FROM empleado_servicios es_r
  JOIN empleados e_r ON e_r.id_empleado = es_r.id_empleado
  WHERE es_r.id_servicio = s.id_servicio AND e_r.activo = TRUE)`;

/** Se puede reservar: no requiere cita, o la requiere y tiene empleados activos asignados. */
export const SQL_RESERVABLE = `(s.requiere_cita = FALSE OR ${SQL_CON_EMPLEADOS})`;

const COLUMNAS_PANEL = `s.id_servicio, s.id_negocio, s.id_categoria, c.nombre AS categoria_nombre,
  s.nombre, s.descripcion, s.indicaciones_previas, s.precio_base, s.precio_maximo, s.tipo_precio, s.duracion_minutos,
  s.margen_minutos, s.tipo_mascota, s.peso_min_kg, s.peso_max_kg, s.requiere_cita, s.max_citas_dia,
  s.dias_disponible, s.visible_app, s.en_oferta, s.precio_oferta, s.fecha_inicio_oferta,
  s.fecha_fin_oferta, s.etiquetas_json, s.activo, s.fecha_creacion, s.fecha_actualizacion,
  ${SQL_PRECIO_ACTUAL} AS precio_actual, ${SQL_OFERTA_VIGENTE} AS oferta_vigente,
  NOT ${SQL_CON_EMPLEADOS} AS sin_empleados, ${SQL_RESERVABLE} AS reservable`;

const FROM_PANEL = "FROM servicios s JOIN categorias_servicio c ON c.id_categoria = s.id_categoria";

// ---------- Panel ----------

/** Servicio con todos sus datos (activo o no). Con `forUpdate` bloquea la fila del servicio. */
export const findById = async (id_servicio, { conn, forUpdate = false } = {}) => {
  const [rows] = await (conn ?? db).query(
    `SELECT ${COLUMNAS_PANEL} ${FROM_PANEL} WHERE s.id_servicio = ?${forUpdate ? " FOR UPDATE OF s" : ""}`,
    [id_servicio]
  );
  return rows[0];
};

/**
 * Página de servicios del negocio. Filtros opcionales: `activo`, `visible_app`,
 * `id_categoria` y `q` (nombre o descripción). Activos primero, luego por nombre.
 */
export const findPageByNegocio = async (id_negocio, { activo, visible_app, id_categoria, q, limit, offset }) => {
  const condiciones = ["s.id_negocio = ?"];
  const valores = [id_negocio];
  if (activo !== undefined) {
    condiciones.push("s.activo = ?");
    valores.push(activo);
  }
  if (visible_app !== undefined) {
    condiciones.push("s.visible_app = ?");
    valores.push(visible_app);
  }
  if (id_categoria !== undefined) {
    condiciones.push("s.id_categoria = ?");
    valores.push(id_categoria);
  }
  if (q) {
    condiciones.push("(s.nombre LIKE ? OR s.descripcion LIKE ?)");
    valores.push(likeLiteral(q), likeLiteral(q));
  }
  const where = `WHERE ${condiciones.join(" AND ")}`;

  const [rows] = await db.query(
    `SELECT ${COLUMNAS_PANEL} ${FROM_PANEL} ${where}
     ORDER BY s.activo DESC, s.nombre, s.id_servicio
     LIMIT ? OFFSET ?`,
    [...valores, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM servicios s ${where}`, valores);
  return { rows, total };
};

/**
 * Empleados activos asignados a cada servicio: { [id_servicio]: [empleado, ...] }.
 * `detalle` agrega especialidad y foto (vista pública).
 */
export const findEmpleadosActivosDeServicios = async (ids, { detalle = false } = {}) => {
  if (ids.length === 0) return {};
  const [rows] = await db.query(
    `SELECT es.id_servicio, e.id_empleado, e.nombre, e.apellido
            ${detalle ? ", e.especialidad, e.foto_url" : ""}
     FROM empleado_servicios es
     JOIN empleados e ON e.id_empleado = es.id_empleado
     WHERE es.id_servicio IN (?) AND e.activo = TRUE
     ORDER BY e.apellido, e.nombre, e.id_empleado`,
    [ids]
  );
  const porServicio = {};
  for (const { id_servicio, ...empleado } of rows) (porServicio[id_servicio] ??= []).push(empleado);
  return porServicio;
};

/** Servicios activos que atiende un empleado (detalle del empleado en el panel). */
export const findActivosDeEmpleado = async (id_empleado) => {
  const [rows] = await db.query(
    `SELECT s.id_servicio, s.nombre
     FROM empleado_servicios es
     JOIN servicios s ON s.id_servicio = es.id_servicio
     WHERE es.id_empleado = ? AND s.activo = TRUE
     ORDER BY s.nombre, s.id_servicio`,
    [id_empleado]
  );
  return rows;
};

/** Servicio activo del negocio con ese nombre (sin distinguir mayúsculas), excepto `excluirId`. */
export const findActivoByNombre = async (id_negocio, nombre, excluirId = 0, conn) => {
  const [rows] = await (conn ?? db).query(
    `SELECT id_servicio FROM servicios
     WHERE id_negocio = ? AND nombre = ? AND activo = TRUE AND id_servicio <> ?
     LIMIT 1`,
    [id_negocio, nombre, excluirId]
  );
  return rows[0];
};

export const categoriaActivaExiste = async (id_categoria, conn) => {
  const [rows] = await (conn ?? db).query(
    "SELECT 1 FROM categorias_servicio WHERE id_categoria = ? AND activo = TRUE",
    [id_categoria]
  );
  return rows.length > 0;
};

/** De los ids dados, los que son empleados activos del negocio. */
export const findEmpleadosActivosDelNegocio = async (id_negocio, ids, conn) => {
  if (ids.length === 0) return [];
  const [rows] = await (conn ?? db).query(
    "SELECT id_empleado FROM empleados WHERE id_negocio = ? AND activo = TRUE AND id_empleado IN (?)",
    [id_negocio, ids]
  );
  return rows.map((row) => row.id_empleado);
};

/** Columnas SET y JSON: los arreglos se guardan como "a,b" y las etiquetas como JSON. */
const columnasDe = (data) => {
  const campos = pick(data, CAMPOS_SERVICIO);
  for (const set of ["tipo_mascota", "dias_disponible"]) {
    if (Array.isArray(campos[set])) campos[set] = campos[set].join(",");
  }
  if ("etiquetas" in data) campos.etiquetas_json = data.etiquetas === null ? null : JSON.stringify(data.etiquetas);
  return campos;
};

export const create = async (id_negocio, data, conn) => {
  const campos = { ...columnasDe(data), id_negocio };
  const columnas = Object.keys(campos);
  const [result] = await (conn ?? db).query(
    `INSERT INTO servicios (${columnas.join(", ")}) VALUES (${columnas.map(() => "?").join(", ")})`,
    Object.values(campos)
  );
  return result.insertId;
};

export const update = async (id_servicio, data, conn) => {
  const campos = columnasDe(data);
  const columnas = Object.keys(campos);
  if (columnas.length === 0) return;
  await (conn ?? db).query(
    `UPDATE servicios SET ${columnas.map((c) => `${c} = ?`).join(", ")} WHERE id_servicio = ?`,
    [...Object.values(campos), id_servicio]
  );
};

export const setActivo = async (id_servicio, activo, conn) => {
  await (conn ?? db).query("UPDATE servicios SET activo = ? WHERE id_servicio = ?", [activo, id_servicio]);
};

/**
 * Reemplaza los empleados activos asignados por `ids`. Las asignaciones de
 * empleados inactivos se conservan (vuelven a contar si se reactivan).
 */
export const replaceEmpleadosActivos = async (id_servicio, ids, conn) => {
  // Se buscan sin bloquear y se borran por clave primaria (id_empleado, id_servicio): un
  // DELETE por id_servicio sin filas toma un gap lock que comparten servicios con ids
  // seguidos y termina en deadlock con el INSERT de otro.
  const [sobran] = await conn.query(
    `SELECT es.id_empleado
     FROM empleado_servicios es
     JOIN empleados e ON e.id_empleado = es.id_empleado
     WHERE es.id_servicio = ? AND e.activo = TRUE ${ids.length ? "AND es.id_empleado NOT IN (?)" : ""}`,
    ids.length ? [id_servicio, ids] : [id_servicio]
  );
  if (sobran.length > 0) {
    await conn.query("DELETE FROM empleado_servicios WHERE (id_empleado, id_servicio) IN (?)", [
      sobran.map((s) => [s.id_empleado, id_servicio]),
    ]);
  }
  if (ids.length) {
    await conn.query("INSERT IGNORE INTO empleado_servicios (id_empleado, id_servicio) VALUES ?", [
      ids.map((id_empleado) => [id_empleado, id_servicio]),
    ]);
  }
};

/** Citas pendientes o confirmadas del servicio desde este momento. */
export const countCitasFuturasActivas = async (id_servicio, conn) => {
  const [[row]] = await (conn ?? db).query(
    `SELECT COUNT(*) AS total
     FROM citas
     WHERE id_servicio = ?
       AND estado IN ('pendiente', 'confirmada')
       AND (fecha > CURDATE() OR (fecha = CURDATE() AND hora_inicio >= CURTIME()))`,
    [id_servicio]
  );
  return row.total;
};

/** Bloquea la fila del negocio: serializa las altas y cambios de nombre de sus servicios. */
export const lockNegocio = async (id_negocio, conn) => {
  await conn.query("SELECT id_negocio FROM negocios WHERE id_negocio = ? FOR UPDATE", [id_negocio]);
};

// ---------- Catálogo ----------

export const findCategoriasActivas = async () => {
  const [rows] = await db.query(
    `SELECT id_categoria, nombre, descripcion, icono, orden_display
     FROM categorias_servicio
     WHERE activo = TRUE
     ORDER BY orden_display, nombre`
  );
  return rows;
};
