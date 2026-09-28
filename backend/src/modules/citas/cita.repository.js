import db from "../../config/db.js";
import { likeLiteral } from "../../shared/utils/sql.js";

// Estados que ocupan la agenda del empleado y de la mascota.
const ESTADOS_OCUPAN = "('pendiente', 'confirmada', 'en_curso')";
// Estados que cuentan para cupos y carga del día (todos menos cancelada y reprogramada).
const ESTADOS_CUENTAN = "c.estado NOT IN ('cancelada', 'reprogramada')";

/** Empleados activos asignados al servicio, por apellido y nombre. */
export const findEmpleadosAsignados = async (id_servicio, conn) => {
  const [rows] = await (conn ?? db).query(
    `SELECT e.id_empleado, e.nombre, e.apellido
     FROM empleado_servicios es
     JOIN empleados e ON e.id_empleado = es.id_empleado
     WHERE es.id_servicio = ? AND e.activo = TRUE
     ORDER BY e.apellido, e.nombre, e.id_empleado`,
    [id_servicio]
  );
  return rows;
};

// ---------- Bloqueos (siempre por clave primaria y en este orden: servicio, empleados, mascota) ----------

export const lockServicio = async (id_servicio, conn) => {
  await conn.query("SELECT id_servicio FROM servicios WHERE id_servicio = ? FOR UPDATE", [id_servicio]);
};

/**
 * Bloquea los empleados en orden de id (sin deadlocks entre reservas que comparten
 * empleados) y devuelve los ids de los que siguen activos.
 */
export const lockEmpleados = async (ids, conn) => {
  const [rows] = await conn.query(
    "SELECT id_empleado, activo FROM empleados WHERE id_empleado IN (?) ORDER BY id_empleado FOR UPDATE",
    [ids]
  );
  return rows.filter((row) => row.activo).map((row) => row.id_empleado);
};

export const lockMascota = async (id_mascota, conn) => {
  const [rows] = await conn.query(
    "SELECT id_mascota, id_usuario, nombre, especie, peso, activo, fallecido FROM mascotas WHERE id_mascota = ? FOR UPDATE",
    [id_mascota]
  );
  return rows[0];
};

// ---------- Agenda del día ----------

/**
 * Citas que ocupan la agenda de los empleados ese día, en minutos, con el
 * margen de su servicio sumado al fin: { [id_empleado]: [{ inicio, fin }] }.
 */
export const findOcupadosDeEmpleados = async (ids, fecha, conn) => {
  if (ids.length === 0) return {};
  const [rows] = await (conn ?? db).query(
    `SELECT c.id_empleado,
            TIME_TO_SEC(c.hora_inicio) DIV 60 AS inicio,
            TIME_TO_SEC(c.hora_fin) DIV 60 + sv.margen_minutos AS fin
     FROM citas c
     JOIN servicios sv ON sv.id_servicio = c.id_servicio
     WHERE c.id_empleado IN (?) AND c.fecha = ? AND c.estado IN ${ESTADOS_OCUPAN}`,
    [ids, fecha]
  );
  const porEmpleado = {};
  for (const { id_empleado, inicio, fin } of rows) {
    (porEmpleado[id_empleado] ??= []).push({ inicio: Number(inicio), fin: Number(fin) });
  }
  return porEmpleado;
};

/** Citas del día de cada empleado (para asignar al que tenga menos): { [id_empleado]: total }. */
export const countCitasDelDia = async (ids, fecha, conn) => {
  const [rows] = await (conn ?? db).query(
    `SELECT c.id_empleado, COUNT(*) AS total FROM citas c
     WHERE c.id_empleado IN (?) AND c.fecha = ? AND ${ESTADOS_CUENTAN}
     GROUP BY c.id_empleado`,
    [ids, fecha]
  );
  return Object.fromEntries(rows.map((row) => [row.id_empleado, row.total]));
};

/** Citas del servicio en la sucursal ese día (para max_citas_dia). */
export const countCupos = async ({ id_servicio, id_sucursal, fecha, excluirIdCita = 0 }, conn) => {
  const [[row]] = await (conn ?? db).query(
    `SELECT COUNT(*) AS total FROM citas c
     WHERE c.id_servicio = ? AND c.id_sucursal = ? AND c.fecha = ? AND ${ESTADOS_CUENTAN} AND c.id_cita <> ?`,
    [id_servicio, id_sucursal, fecha, excluirIdCita]
  );
  return row.total;
};

/** La mascota ya tiene una cita (en cualquier negocio) que se cruza con [hora_inicio, hora_fin). */
export const mascotaTieneCruce = async ({ id_mascota, fecha, hora_inicio, hora_fin }, conn) => {
  const [rows] = await (conn ?? db).query(
    `SELECT 1 FROM citas c
     WHERE c.id_mascota = ? AND c.fecha = ? AND c.estado IN ${ESTADOS_OCUPAN}
       AND c.hora_inicio < ? AND ? < c.hora_fin
     LIMIT 1`,
    [id_mascota, fecha, hora_fin, hora_inicio]
  );
  return rows.length > 0;
};

// ---------- Escritura ----------

const COLUMNAS_CITA = [
  "id_negocio",
  "id_sucursal",
  "id_usuario",
  "id_mascota",
  "id_servicio",
  "id_empleado",
  "fecha",
  "hora_inicio",
  "hora_fin",
  "estado",
  "precio_estimado",
  "notas_cliente",
  "notas_internas",
  "prioridad",
  "origen",
  "id_cita_origen",
];

export const create = async (data, conn) => {
  const columnas = COLUMNAS_CITA.filter((c) => data[c] !== undefined);
  const [result] = await conn.query(
    `INSERT INTO citas (${columnas.join(", ")}) VALUES (${columnas.map(() => "?").join(", ")})`,
    columnas.map((c) => data[c])
  );
  return result.insertId;
};

/** Primer registro de historial_citas: la creación (estado de null al inicial). */
/**
 * Registra un cambio en historial_citas. `actor`: { id_usuario, id_empleado?, ip? }.
 * Los valores se guardan como texto (null se conserva).
 */
export const insertHistorial = async ({ id_cita, actor, campo, anterior = null, nuevo = null, motivo = null }, conn) => {
  const texto = (v) => (v === null || v === undefined ? null : String(v));
  await conn.query(
    `INSERT INTO historial_citas (id_cita, id_empleado, id_usuario, campo_modificado, valor_anterior, valor_nuevo, motivo, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id_cita, actor.id_empleado ?? null, actor.id_usuario, campo, texto(anterior), texto(nuevo), motivo, actor.ip ?? null]
  );
};

/** Primer registro de historial_citas: la creación (estado de null al inicial). */
export const insertHistorialCreacion = ({ id_cita, actor, estado, motivo = "Cita creada" }, conn) =>
  insertHistorial({ id_cita, actor, campo: "estado", nuevo: estado, motivo }, conn);

/** Bloquea la cita (FOR UPDATE por clave primaria) y la devuelve con sus columnas. */
export const lockCita = async (id_cita, conn) => {
  const [rows] = await conn.query(
    `SELECT id_cita, id_negocio, id_sucursal, id_usuario, id_mascota, id_servicio, id_empleado, fecha,
            hora_inicio, hora_fin, estado, precio_estimado, precio_final, notas_cliente, notas_internas,
            prioridad, origen, cancelacion_tardia
     FROM citas WHERE id_cita = ? FOR UPDATE`,
    [id_cita]
  );
  return rows[0];
};

/** Cita sin bloquear (para preparar una reprogramación antes de la transacción). */
export const findCita = async (id_cita) => {
  const [rows] = await db.query(
    `SELECT id_cita, id_negocio, id_sucursal, id_usuario, id_mascota, id_servicio, id_empleado, fecha,
            hora_inicio, hora_fin, estado, precio_estimado, notas_cliente, notas_internas, prioridad, origen
     FROM citas WHERE id_cita = ?`,
    [id_cita]
  );
  return rows[0];
};

const CAMPOS_ACTUALIZABLES = [
  "estado",
  "notas_internas",
  "prioridad",
  "precio_final",
  "id_empleado",
  "motivo_cancelacion",
  "cancelada_por",
  "cancelacion_tardia",
];

/** Actualiza la cita con la lista blanca; `fecha_cancelacion` se pone con NOW() si se pide. */
export const update = async (id_cita, campos, conn, { conFechaCancelacion = false } = {}) => {
  const columnas = CAMPOS_ACTUALIZABLES.filter((c) => campos[c] !== undefined);
  const asignaciones = [...columnas.map((c) => `${c} = ?`), ...(conFechaCancelacion ? ["fecha_cancelacion = NOW()"] : [])];
  if (asignaciones.length === 0) return;
  await conn.query(`UPDATE citas SET ${asignaciones.join(", ")} WHERE id_cita = ?`, [
    ...columnas.map((c) => campos[c]),
    id_cita,
  ]);
};

/** Los recordatorios pendientes de la cita ya no se envían (cancelada o reprogramada). */
export const cancelarRecordatoriosPendientes = async (id_cita, conn) => {
  await conn.query("UPDATE recordatorios SET estado = 'cancelado' WHERE id_cita = ? AND estado = 'pendiente'", [id_cita]);
};

/** Una cita completada suma al contador del negocio. */
export const incrementTotalCitas = async (id_negocio, conn) => {
  await conn.query("UPDATE negocios SET total_citas = total_citas + 1 WHERE id_negocio = ?", [id_negocio]);
};

/**
 * Cumplimiento del cliente **en ese negocio** (nunca en otros): citas completadas,
 * inasistencias y cancelaciones tardías. Usa el índice (id_negocio, id_usuario, estado).
 */
export const resumenCumplimiento = async (id_usuario, id_negocio, conn) => {
  const [[row]] = await (conn ?? db).query(
    `SELECT COALESCE(SUM(estado = 'completada'), 0) AS completadas,
            COALESCE(SUM(estado = 'no_asistio'), 0) AS inasistencias,
            COALESCE(SUM(estado = 'cancelada' AND cancelacion_tardia = TRUE), 0) AS cancelaciones_tardias
     FROM citas
     WHERE id_negocio = ? AND id_usuario = ?`,
    [id_negocio, id_usuario]
  );
  return {
    completadas: Number(row.completadas),
    inasistencias: Number(row.inasistencias),
    cancelaciones_tardias: Number(row.cancelaciones_tardias),
  };
};

/** Historial de la cita, del más antiguo al más reciente, con quién hizo cada cambio. */
export const findHistorial = async (id_cita) => {
  const [rows] = await db.query(
    `SELECT h.id_historial, h.fecha_cambio, h.campo_modificado, h.valor_anterior, h.valor_nuevo, h.motivo,
            h.id_usuario, u.nombre AS usuario_nombre, u.apellido AS usuario_apellido,
            h.id_empleado, e.nombre AS empleado_nombre, e.apellido AS empleado_apellido
     FROM historial_citas h
     LEFT JOIN usuarios u ON u.id_usuario = h.id_usuario
     LEFT JOIN empleados e ON e.id_empleado = h.id_empleado
     WHERE h.id_cita = ?
     ORDER BY h.fecha_cambio, h.id_historial`,
    [id_cita]
  );
  return rows;
};

/** Nombres de empleados por id (para mostrar los cambios de empleado del historial). */
export const findNombresEmpleados = async (ids) => {
  if (ids.length === 0) return {};
  const [rows] = await db.query("SELECT id_empleado, nombre, apellido FROM empleados WHERE id_empleado IN (?)", [ids]);
  return Object.fromEntries(rows.map((e) => [e.id_empleado, `${e.nombre} ${e.apellido}`]));
};

/**
 * Recordatorio de una cita que nace confirmada (desde el panel). Es el mismo que
 * crea el trigger trg_citas_after_update al pasar a confirmada, que no actúa en INSERT.
 */
export const insertRecordatorioConfirmada = async (id_cita, conn) => {
  await conn.query(
    `INSERT INTO recordatorios (id_usuario, id_mascota, id_cita, tipo, titulo, mensaje, canal, estado, fecha_programada)
     SELECT c.id_usuario, c.id_mascota, c.id_cita, 'cita_recordatorio', 'Recordatorio de tu cita',
            CONCAT('Tu cita está programada para el ', DATE_FORMAT(c.fecha, '%d/%m/%Y'),
                   ' a las ', TIME_FORMAT(c.hora_inicio, '%H:%i'), '. ¡Te esperamos!'),
            'push,whatsapp', 'pendiente',
            DATE_SUB(CONCAT(c.fecha, ' ', c.hora_inicio), INTERVAL 2 HOUR)
     FROM citas c WHERE c.id_cita = ?`,
    [id_cita]
  );
};

// ---------- Lectura ----------

// Cita con negocio, sucursal (con ubicación para "Cómo llegar"), servicio, empleado, mascota y cliente.
const SELECT_CITA = `
  SELECT c.id_cita, c.fecha,
         TIME_FORMAT(c.hora_inicio, '%H:%i') AS hora_inicio, TIME_FORMAT(c.hora_fin, '%H:%i') AS hora_fin,
         c.estado, c.origen, c.prioridad, c.precio_estimado, c.precio_final, c.notas_cliente, c.notas_internas,
         c.id_cita_origen, c.fecha_creacion,
         c.motivo_cancelacion, c.cancelada_por, c.fecha_cancelacion, c.cancelacion_tardia,
         n.id_negocio, n.nombre AS negocio_nombre, n.logo_url AS negocio_logo_url,
         su.id_sucursal, su.nombre AS sucursal_nombre, su.direccion AS sucursal_direccion,
         su.telefono AS sucursal_telefono, su.latitud AS sucursal_latitud, su.longitud AS sucursal_longitud,
         sv.id_servicio, sv.nombre AS servicio_nombre, sv.duracion_minutos,
         e.id_empleado, e.nombre AS empleado_nombre, e.apellido AS empleado_apellido,
         m.id_mascota, m.nombre AS mascota_nombre, m.especie AS mascota_especie,
         u.id_usuario, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.telefono AS cliente_telefono
  FROM citas c
  JOIN negocios n ON n.id_negocio = c.id_negocio
  LEFT JOIN sucursales su ON su.id_sucursal = c.id_sucursal
  JOIN servicios sv ON sv.id_servicio = c.id_servicio
  LEFT JOIN empleados e ON e.id_empleado = c.id_empleado
  JOIN mascotas m ON m.id_mascota = c.id_mascota
  JOIN usuarios u ON u.id_usuario = c.id_usuario`;

export const findDetalle = async (id_cita, conn) => {
  const [rows] = await (conn ?? db).query(`${SELECT_CITA} WHERE c.id_cita = ?`, [id_cita]);
  return rows[0];
};

/** La cita es de ese usuario (dueño de la mascota que la pidió). */
export const esDelUsuario = async (id_cita, id_usuario) => {
  const [rows] = await db.query("SELECT 1 FROM citas WHERE id_cita = ? AND id_usuario = ?", [id_cita, id_usuario]);
  return rows.length > 0;
};

// Una cita es "próxima" mientras no termina.
const SQL_PROXIMA = "(c.fecha > CURDATE() OR (c.fecha = CURDATE() AND c.hora_fin >= CURTIME()))";

/**
 * Citas del dueño, paginadas. `alcance`: proximas (de la más cercana a la más
 * lejana), pasadas o todas (de la más reciente hacia atrás).
 */
export const findPageDeUsuario = async (id_usuario, { alcance, estados, id_mascota, id_negocio, limit, offset }) => {
  const condiciones = ["c.id_usuario = ?"];
  const valores = [id_usuario];
  // Citas del cliente con un negocio (detalle del cliente en el panel).
  if (id_negocio) {
    condiciones.push("c.id_negocio = ?");
    valores.push(id_negocio);
  }
  if (alcance === "proximas") condiciones.push(SQL_PROXIMA);
  if (alcance === "pasadas") condiciones.push(`NOT ${SQL_PROXIMA}`);
  if (estados) {
    condiciones.push("c.estado IN (?)");
    valores.push(estados);
  }
  if (id_mascota) {
    condiciones.push("c.id_mascota = ?");
    valores.push(id_mascota);
  }
  const where = `WHERE ${condiciones.join(" AND ")}`;
  const orden = alcance === "proximas" ? "c.fecha, c.hora_inicio, c.id_cita" : "c.fecha DESC, c.hora_inicio DESC, c.id_cita DESC";

  const [rows] = await db.query(`${SELECT_CITA} ${where} ORDER BY ${orden} LIMIT ? OFFSET ?`, [...valores, limit, offset]);
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM citas c ${where}`, valores);
  return { rows, total };
};

/**
 * Agenda del negocio entre `desde` y `hasta` (el servicio limita el rango), por
 * fecha y hora. Filtros opcionales: estados, sucursal, empleado, servicio y `q`
 * (nombre del cliente o de la mascota).
 */
export const findAgenda = async ({ id_negocio, desde, hasta, estados, id_sucursal, id_empleado, id_servicio, q }) => {
  const condiciones = ["c.id_negocio = ?", "c.fecha BETWEEN ? AND ?"];
  const valores = [id_negocio, desde, hasta];
  if (estados) {
    condiciones.push("c.estado IN (?)");
    valores.push(estados);
  }
  for (const [columna, valor] of [
    ["c.id_sucursal", id_sucursal],
    ["c.id_empleado", id_empleado],
    ["c.id_servicio", id_servicio],
  ]) {
    if (valor !== undefined) {
      condiciones.push(`${columna} = ?`);
      valores.push(valor);
    }
  }
  if (q) {
    condiciones.push(
      "(u.nombre LIKE ? OR u.apellido LIKE ? OR CONCAT(u.nombre, ' ', u.apellido) LIKE ? OR m.nombre LIKE ?)"
    );
    valores.push(...Array(4).fill(likeLiteral(q)));
  }
  const [rows] = await db.query(
    `${SELECT_CITA} WHERE ${condiciones.join(" AND ")} ORDER BY c.fecha, c.hora_inicio, c.id_cita`,
    valores
  );
  return rows;
};

/** El recurso (sucursal, empleado o servicio) es de ese negocio, activo o no. */
export const perteneceAlNegocio = async (tabla, id, id_negocio) => {
  const columnas = { sucursales: "id_sucursal", empleados: "id_empleado", servicios: "id_servicio" };
  const [rows] = await db.query(`SELECT 1 FROM ${tabla} WHERE ${columnas[tabla]} = ? AND id_negocio = ?`, [id, id_negocio]);
  return rows.length > 0;
};

/** Negocio activo (la app solo reserva en negocios activos). */
export const negocioActivo = async (id_negocio, conn) => {
  const [rows] = await (conn ?? db).query("SELECT 1 FROM negocios WHERE id_negocio = ? AND activo = TRUE", [id_negocio]);
  return rows.length > 0;
};

/** Usuario activo (cliente de una cita del panel). */
export const usuarioActivo = async (id_usuario, conn) => {
  const [rows] = await (conn ?? db).query("SELECT 1 FROM usuarios WHERE id_usuario = ? AND activo = TRUE", [id_usuario]);
  return rows.length > 0;
};
