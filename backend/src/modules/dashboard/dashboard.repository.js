import db from "../../config/db.js";

/**
 * Consultas del dashboard (2.7). Todas son agregados sobre las citas del negocio en un
 * rango de `citas.fecha` (índice (id_negocio, fecha)); `id_sucursal` es opcional.
 */

/** Filtro común: negocio, rango y sucursal opcional (alias `c`). */
const filtroCitas = ({ id_negocio, desde, hasta, id_sucursal }) => {
  const condiciones = ["c.id_negocio = ?", "c.fecha BETWEEN ? AND ?"];
  const valores = [id_negocio, desde, hasta];
  if (id_sucursal !== undefined) {
    condiciones.push("c.id_sucursal = ?");
    valores.push(id_sucursal);
  }
  return { where: condiciones.join(" AND "), valores };
};

/**
 * Por estado: cuántas citas, ingresos registrados (precio_final de las completadas) y, en
 * las canceladas, quién canceló y cuántas fueron tardías.
 */
export const findResumenPorEstado = async (filtro) => {
  const { where, valores } = filtroCitas(filtro);
  const [rows] = await db.query(
    `SELECT c.estado, COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN c.estado = 'completada' THEN c.precio_final END), 0) AS ingresos,
            COALESCE(SUM(c.cancelada_por = 'dueno'), 0) AS por_dueno,
            COALESCE(SUM(c.cancelada_por = 'negocio'), 0) AS por_negocio,
            COALESCE(SUM(c.cancelada_por = 'sistema'), 0) AS por_sistema,
            COALESCE(SUM(c.cancelacion_tardia = TRUE AND NOT (c.cancelada_por <=> 'sistema')), 0) AS tardias
     FROM citas c WHERE ${where}
     GROUP BY c.estado`,
    valores
  );
  return rows;
};

/** Citas de hoy por estado (sin importar el rango del dashboard). */
export const findHoyPorEstado = async ({ id_negocio, hoy, id_sucursal }) =>
  findResumenPorEstado({ id_negocio, desde: hoy, hasta: hoy, id_sucursal });

/** Citas pendientes desde hoy: esperan que el negocio las confirme. */
export const countPorConfirmar = async ({ id_negocio, hoy, id_sucursal }) => {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS total FROM citas c
     WHERE c.id_negocio = ? AND c.estado = 'pendiente' AND c.fecha >= ?
       ${id_sucursal !== undefined ? "AND c.id_sucursal = ?" : ""}`,
    [id_negocio, hoy, ...(id_sucursal !== undefined ? [id_sucursal] : [])]
  );
  return row.total;
};

/** Los `limite` servicios con más citas completadas en el rango, con sus ingresos. */
export const findServiciosMasPedidos = async (filtro, limite = 5) => {
  const { where, valores } = filtroCitas(filtro);
  const [rows] = await db.query(
    `SELECT sv.id_servicio, sv.nombre, COUNT(*) AS completadas, COALESCE(SUM(c.precio_final), 0) AS ingresos
     FROM citas c JOIN servicios sv ON sv.id_servicio = c.id_servicio
     WHERE ${where} AND c.estado = 'completada'
     GROUP BY sv.id_servicio, sv.nombre
     ORDER BY completadas DESC, ingresos DESC, sv.nombre
     LIMIT ?`,
    [...valores, limite]
  );
  return rows;
};

/**
 * Clientes cuya relación con el negocio empezó en el rango: su primera cita (cualquier
 * estado) o el registro desde el panel, lo que ocurrió primero (definición de la 1.7).
 * Es del negocio completo: no se filtra por sucursal.
 */
export const countClientesNuevos = async ({ id_negocio, desde, hasta }) => {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM (
       SELECT r.id_usuario, MIN(r.desde) AS primera
       FROM (
         SELECT id_usuario, MIN(fecha) AS desde FROM citas WHERE id_negocio = ? GROUP BY id_usuario
         UNION ALL
         SELECT id_usuario, MIN(DATE(fecha_autorizacion)) FROM autorizaciones_datos WHERE id_negocio = ? GROUP BY id_usuario
       ) r
       GROUP BY r.id_usuario
     ) p
     JOIN usuarios u ON u.id_usuario = p.id_usuario AND u.activo = TRUE
     WHERE p.primera BETWEEN ? AND ?`,
    [id_negocio, id_negocio, desde, hasta]
  );
  return row.total;
};

/** Calificación actual del negocio, reseñas visibles del rango y cuántas siguen sin responder. */
export const findCalificacion = async ({ id_negocio, desde, hasta }) => {
  const [[row]] = await db.query(
    `SELECT n.calificacion_promedio, n.total_resenas, n.confirmacion_automatica,
            (SELECT COUNT(*) FROM resenas r
             WHERE r.id_negocio = n.id_negocio AND r.visible = TRUE AND r.fecha_creacion >= ? AND r.fecha_creacion < ? + INTERVAL 1 DAY) AS resenas_periodo,
            (SELECT AVG(r.calificacion) FROM resenas r
             WHERE r.id_negocio = n.id_negocio AND r.visible = TRUE AND r.fecha_creacion >= ? AND r.fecha_creacion < ? + INTERVAL 1 DAY) AS promedio_periodo,
            (SELECT COUNT(*) FROM resenas r
             WHERE r.id_negocio = n.id_negocio AND r.visible = TRUE AND r.respuesta_negocio IS NULL) AS sin_responder
     FROM negocios n WHERE n.id_negocio = ?`,
    [desde, hasta, desde, hasta, id_negocio]
  );
  return row;
};

/** Plan activo más barato con estadísticas avanzadas (el que las desbloquea). */
export const findPlanConEstadisticas = async () => {
  const [rows] = await db.query(
    `SELECT id_plan, nombre, precio_mensual FROM planes_suscripcion
     WHERE activo = TRUE AND estadisticas_avanzadas = TRUE
     ORDER BY precio_mensual, orden_display
     LIMIT 1`
  );
  return rows[0] ?? null;
};

// ---------- Avanzadas ----------

// Inicio de cada intervalo de la tendencia (constantes: nunca vienen del usuario).
const INICIO_INTERVALO = {
  dia: "c.fecha",
  semana: "DATE_SUB(c.fecha, INTERVAL WEEKDAY(c.fecha) DAY)",
  mes: "DATE_FORMAT(c.fecha, '%Y-%m-01')",
};

/** Citas (sin reprogramadas), completadas e ingresos por día, semana (desde el lunes) o mes. */
export const findTendencia = async (filtro, agrupacion) => {
  const { where, valores } = filtroCitas(filtro);
  const inicio = INICIO_INTERVALO[agrupacion];
  const [rows] = await db.query(
    `SELECT DATE_FORMAT(${inicio}, '%Y-%m-%d') AS inicio,
            SUM(c.estado <> 'reprogramada') AS citas,
            SUM(c.estado = 'completada') AS completadas,
            COALESCE(SUM(CASE WHEN c.estado = 'completada' THEN c.precio_final END), 0) AS ingresos
     FROM citas c WHERE ${where}
     GROUP BY inicio ORDER BY inicio`,
    valores
  );
  return rows;
};

/** Por empleado (NULL = sin asignar): citas, completadas, ingresos e inasistencias. */
export const findPorEmpleado = async (filtro) => {
  const { where, valores } = filtroCitas(filtro);
  const [rows] = await db.query(
    `SELECT c.id_empleado, e.nombre, e.apellido,
            SUM(c.estado NOT IN ('cancelada', 'reprogramada')) AS citas,
            SUM(c.estado = 'completada') AS completadas,
            COALESCE(SUM(CASE WHEN c.estado = 'completada' THEN c.precio_final END), 0) AS ingresos,
            SUM(c.estado = 'no_asistio') AS inasistencias
     FROM citas c LEFT JOIN empleados e ON e.id_empleado = c.id_empleado
     WHERE ${where}
     GROUP BY c.id_empleado, e.nombre, e.apellido
     ORDER BY completadas DESC, ingresos DESC, c.id_empleado IS NULL, e.apellido, e.nombre`,
    valores
  );
  return rows;
};

/** Por sucursal: citas, completadas, ingresos e inasistencias. */
export const findPorSucursal = async (filtro) => {
  const { where, valores } = filtroCitas(filtro);
  const [rows] = await db.query(
    `SELECT c.id_sucursal, s.nombre,
            SUM(c.estado NOT IN ('cancelada', 'reprogramada')) AS citas,
            SUM(c.estado = 'completada') AS completadas,
            COALESCE(SUM(CASE WHEN c.estado = 'completada' THEN c.precio_final END), 0) AS ingresos,
            SUM(c.estado = 'no_asistio') AS inasistencias
     FROM citas c LEFT JOIN sucursales s ON s.id_sucursal = c.id_sucursal
     WHERE ${where}
     GROUP BY c.id_sucursal, s.nombre
     ORDER BY completadas DESC, ingresos DESC, s.nombre`,
    valores
  );
  return rows;
};

/** Citas (sin canceladas ni reprogramadas) por día de la semana (0 = domingo) y hora de inicio. */
export const findHorasPico = async (filtro) => {
  const { where, valores } = filtroCitas(filtro);
  const [rows] = await db.query(
    `SELECT DAYOFWEEK(c.fecha) - 1 AS dia_semana, HOUR(c.hora_inicio) AS hora, COUNT(*) AS citas
     FROM citas c WHERE ${where} AND c.estado NOT IN ('cancelada', 'reprogramada')
     GROUP BY dia_semana, hora
     ORDER BY citas DESC, dia_semana, hora`,
    valores
  );
  return rows;
};

/** Clientes con alguna cita completada en el rango y cuántos tienen dos o más. */
export const findRecurrencia = async (filtro) => {
  const { where, valores } = filtroCitas(filtro);
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS clientes, COALESCE(SUM(t.completadas >= 2), 0) AS recurrentes
     FROM (SELECT c.id_usuario, COUNT(*) AS completadas FROM citas c
           WHERE ${where} AND c.estado = 'completada' GROUP BY c.id_usuario) t`,
    valores
  );
  return row;
};
