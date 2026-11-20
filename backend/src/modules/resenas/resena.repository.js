import db from "../../config/db.js";

// ---------- Bloqueos (orden: cita, negocio, reseña) ----------

/** Bloquea la cita que se reseña, con el estado de su dueño y de su negocio. */
export const lockCita = async (id_cita, conn) => {
  const [rows] = await conn.query(
    `SELECT c.id_cita, c.id_negocio, c.id_usuario, c.id_mascota, c.estado, c.fecha_completada
     FROM citas c WHERE c.id_cita = ? FOR UPDATE`,
    [id_cita]
  );
  return rows[0];
};

/**
 * Bloquea la cita sin esperar (job de invitaciones): null si otra transacción la tiene.
 * Trae si el dueño y el negocio siguen activos.
 */
export const lockCitaSinEsperar = async (id_cita, conn) => {
  const [rows] = await conn.query(
    `SELECT c.id_cita, c.id_negocio, c.id_usuario, c.estado, c.fecha_completada,
            u.activo AS usuario_activo, n.activo AS negocio_activo, m.fallecido AS mascota_fallecida
     FROM citas c
     JOIN usuarios u ON u.id_usuario = c.id_usuario
     JOIN negocios n ON n.id_negocio = c.id_negocio
     LEFT JOIN mascotas m ON m.id_mascota = c.id_mascota
     WHERE c.id_cita = ? FOR UPDATE OF c SKIP LOCKED`,
    [id_cita]
  );
  return rows[0] ?? null;
};

/**
 * Bloquea la fila del negocio antes de escribir algo que cambie su calificación: el trigger
 * lee las reseñas del negocio con bloqueos y dos escrituras simultáneas podrían bloquearse
 * mutuamente.
 */
export const lockNegocio = async (id_negocio, conn) => {
  await conn.query("SELECT id_negocio FROM negocios WHERE id_negocio = ? FOR UPDATE", [id_negocio]);
};

// ---------- Reglas ----------

/** El usuario es propietario del negocio o empleado activo con su cuenta vinculada. */
export const esPersonal = async (id_usuario, id_negocio, conn) => {
  const [rows] = await (conn ?? db).query(
    `SELECT 1 FROM negocios WHERE id_negocio = ? AND id_usuario_propietario = ?
     UNION ALL
     SELECT 1 FROM empleados WHERE id_negocio = ? AND id_usuario = ? AND activo = TRUE
     LIMIT 1`,
    [id_negocio, id_usuario, id_negocio, id_usuario]
  );
  return rows.length > 0;
};

/** Negocios donde el usuario es propietario o empleado activo: Set de id_negocio. */
export const findNegociosDelPersonal = async (id_usuario) => {
  const [rows] = await db.query(
    `SELECT id_negocio FROM negocios WHERE id_usuario_propietario = ?
     UNION
     SELECT id_negocio FROM empleados WHERE id_usuario = ? AND activo = TRUE`,
    [id_usuario, id_usuario]
  );
  return new Set(rows.map((row) => row.id_negocio));
};

/** El negocio registró al usuario desde el panel (autorización con canal panel, revocada o no). */
export const registradoPorNegocio = async (id_usuario, id_negocio, conn) => {
  const [rows] = await conn.query(
    "SELECT 1 FROM autorizaciones_datos WHERE id_usuario = ? AND id_negocio = ? AND canal = 'panel' LIMIT 1",
    [id_usuario, id_negocio]
  );
  return rows.length > 0;
};

// ---------- Escritura ----------

export const findByCita = async (id_cita, conn) => {
  const [rows] = await conn.query("SELECT id_resena, retirada_en FROM resenas WHERE id_cita = ?", [id_cita]);
  return rows[0];
};

export const create = async (data, conn) => {
  const [result] = await conn.query(
    `INSERT INTO resenas (id_negocio, id_usuario, id_cita, calificacion, titulo, comentario,
                          calif_atencion, calif_precio, calif_instalaciones, calif_puntualidad,
                          cliente_registrado_por_negocio)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.id_negocio,
      data.id_usuario,
      data.id_cita,
      data.calificacion,
      data.titulo,
      data.comentario,
      data.calif_atencion,
      data.calif_precio,
      data.calif_instalaciones,
      data.calif_puntualidad,
      data.cliente_registrado_por_negocio,
    ]
  );
  return result.insertId;
};

/** Reseña bloqueada (FOR UPDATE), sin joins. */
export const lockResena = async (id_resena, conn) => {
  const [rows] = await conn.query(
    `SELECT id_resena, id_negocio, id_usuario, id_cita, visible, reportada, retirada_en,
            respuesta_negocio, fecha_respuesta
     FROM resenas WHERE id_resena = ? FOR UPDATE`,
    [id_resena]
  );
  return rows[0];
};

/** Reseña sin bloquear (para saber qué cita y negocio bloquear primero). */
export const findBasica = async (id_resena) => {
  const [rows] = await db.query("SELECT id_resena, id_negocio, id_usuario, id_cita, retirada_en FROM resenas WHERE id_resena = ?", [
    id_resena,
  ]);
  return rows[0];
};

/** El autor reemplaza su reseña. */
export const updateContenido = async (id_resena, data, conn) => {
  await conn.query(
    `UPDATE resenas
     SET calificacion = ?, titulo = ?, comentario = ?, calif_atencion = ?, calif_precio = ?,
         calif_instalaciones = ?, calif_puntualidad = ?, fecha_edicion = NOW()
     WHERE id_resena = ?`,
    [
      data.calificacion,
      data.titulo,
      data.comentario,
      data.calif_atencion,
      data.calif_precio,
      data.calif_instalaciones,
      data.calif_puntualidad,
      id_resena,
    ]
  );
};

/** El autor la retira: deja de ser visible (el trigger recalcula la calificación del negocio). */
export const retirar = async (id_resena, conn) => {
  await conn.query("UPDATE resenas SET visible = FALSE, retirada_en = NOW() WHERE id_resena = ?", [id_resena]);
};

/**
 * Respuesta del negocio. La primera fija fecha_respuesta; las siguientes (también tras
 * borrarla) quedan en fecha_edicion_respuesta.
 */
export const responder = async (id_resena, respuesta, { primera }, conn) => {
  await conn.query(
    primera
      ? "UPDATE resenas SET respuesta_negocio = ?, fecha_respuesta = NOW(), fecha_edicion_respuesta = NULL WHERE id_resena = ?"
      : "UPDATE resenas SET respuesta_negocio = ?, fecha_edicion_respuesta = NOW() WHERE id_resena = ?",
    [respuesta, id_resena]
  );
};

/** Borra el texto de la respuesta; fecha_respuesta se conserva (el aviso al dueño no se repite). */
export const borrarRespuesta = async (id_resena, conn) => {
  await conn.query("UPDATE resenas SET respuesta_negocio = NULL, fecha_edicion_respuesta = NULL WHERE id_resena = ?", [id_resena]);
};

/** Reporte del negocio: no cambia `visible` (la reseña sigue publicada hasta que la revise el super admin). */
export const reportar = async (id_resena, { motivo, detalle, id_usuario }, conn) => {
  await conn.query(
    `UPDATE resenas
     SET reportada = TRUE, motivo_reporte = ?, detalle_reporte = ?, fecha_reporte = NOW(), id_usuario_reporta = ?
     WHERE id_resena = ?`,
    [motivo, detalle, id_usuario, id_resena]
  );
};

// ---------- Lectura ----------

const SELECT_RESENA = `
  SELECT r.id_resena, r.id_negocio, r.id_usuario, r.id_cita, r.calificacion, r.titulo, r.comentario,
         r.calif_atencion, r.calif_precio, r.calif_instalaciones, r.calif_puntualidad,
         r.respuesta_negocio, r.fecha_respuesta, r.fecha_edicion_respuesta,
         r.visible, r.reportada, r.motivo_reporte, r.detalle_reporte, r.fecha_reporte,
         r.cliente_registrado_por_negocio, r.fecha_creacion, r.fecha_edicion, r.retirada_en,
         u.nombre AS autor_nombre, u.apellido AS autor_apellido,
         n.nombre AS negocio_nombre, n.logo_url AS negocio_logo_url,
         c.fecha AS cita_fecha, c.fecha_completada, sv.id_servicio, sv.nombre AS servicio_nombre,
         ur.id_usuario AS reporta_id_usuario, ur.nombre AS reporta_nombre, ur.apellido AS reporta_apellido
  FROM resenas r
  JOIN usuarios u ON u.id_usuario = r.id_usuario
  JOIN negocios n ON n.id_negocio = r.id_negocio
  LEFT JOIN citas c ON c.id_cita = r.id_cita
  LEFT JOIN servicios sv ON sv.id_servicio = c.id_servicio
  LEFT JOIN usuarios ur ON ur.id_usuario = r.id_usuario_reporta`;

export const findById = async (id_resena, conn) => {
  const [rows] = await (conn ?? db).query(`${SELECT_RESENA} WHERE r.id_resena = ?`, [id_resena]);
  return rows[0];
};

// Órdenes permitidos (lista blanca: el query solo elige la clave).
const ORDENES = {
  recientes: "r.fecha_creacion DESC, r.id_resena DESC",
  mejores: "r.calificacion DESC, r.fecha_creacion DESC, r.id_resena DESC",
  peores: "r.calificacion ASC, r.fecha_creacion DESC, r.id_resena DESC",
};

const pagina = async (condiciones, valores, { orden = "recientes", limit, offset }) => {
  const where = `WHERE ${condiciones.join(" AND ")}`;
  const [rows] = await db.query(`${SELECT_RESENA} ${where} ORDER BY ${ORDENES[orden]} LIMIT ? OFFSET ?`, [
    ...valores,
    limit,
    offset,
  ]);
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM resenas r ${where}`, valores);
  return { rows, total };
};

/** Filtro por calificación exacta o "hasta" (`calificacion_max`: 2 = de 1 a 2 estrellas). */
const filtroCalificacion = (condiciones, valores, { calificacion, calificacion_max }) => {
  if (calificacion !== undefined) {
    condiciones.push("r.calificacion = ?");
    valores.push(calificacion);
  }
  if (calificacion_max !== undefined) {
    condiciones.push("r.calificacion <= ?");
    valores.push(calificacion_max);
  }
};

/** Reseñas visibles del negocio (lo público). */
export const findPublicas = (id_negocio, { calificacion, calificacion_max, ...opciones }) => {
  const condiciones = ["r.id_negocio = ?", "r.visible = TRUE"];
  const valores = [id_negocio];
  filtroCalificacion(condiciones, valores, { calificacion, calificacion_max });
  return pagina(condiciones, valores, opciones);
};

/** Cuántas reseñas visibles tiene el negocio de cada calificación: { 1: n, ..., 5: n }. */
export const findDistribucion = async (id_negocio) => {
  const [rows] = await db.query(
    "SELECT calificacion, COUNT(*) AS total FROM resenas WHERE id_negocio = ? AND visible = TRUE GROUP BY calificacion",
    [id_negocio]
  );
  const distribucion = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of rows) distribucion[row.calificacion] = row.total;
  return distribucion;
};

// Estado de una reseña en el panel. Retirar también pone visible = FALSE, así que la
// retirada se mira primero: "oculta" es solo la que ocultó la moderación.
const ESTADOS = {
  publicada: "r.retirada_en IS NULL AND r.visible = TRUE",
  oculta: "r.retirada_en IS NULL AND r.visible = FALSE",
  retirada: "r.retirada_en IS NOT NULL",
};

/**
 * Reseñas del negocio para el panel: publicadas, ocultas por la moderación y retiradas por
 * su autor. Filtros: estado, calificacion, calificacion_max, reportada, visible, id_resena y
 * sin_responder (publicadas sin respuesta, las que el negocio puede atender).
 */
export const findGestion = (
  id_negocio,
  { estado, calificacion, calificacion_max, reportada, sin_responder, visible, id_resena, ...opciones }
) => {
  const condiciones = ["r.id_negocio = ?"];
  const valores = [id_negocio];
  if (estado) condiciones.push(ESTADOS[estado]);
  filtroCalificacion(condiciones, valores, { calificacion, calificacion_max });
  for (const [columna, valor] of [
    ["r.reportada", reportada],
    ["r.visible", visible],
    ["r.id_resena", id_resena],
  ]) {
    if (valor !== undefined) {
      condiciones.push(`${columna} = ?`);
      valores.push(valor);
    }
  }
  if (sin_responder !== undefined) {
    condiciones.push(sin_responder ? `${ESTADOS.publicada} AND r.respuesta_negocio IS NULL` : "r.respuesta_negocio IS NOT NULL");
  }
  return pagina(condiciones, valores, opciones);
};

/** Conteos del panel, sin filtros: sin responder (publicadas), reportadas, ocultas y retiradas. */
export const findConteosGestion = async (id_negocio) => {
  const [[row]] = await db.query(
    `SELECT COALESCE(SUM(${ESTADOS.publicada} AND r.respuesta_negocio IS NULL), 0) AS sin_responder,
            COALESCE(SUM(r.retirada_en IS NULL AND r.reportada = TRUE), 0) AS reportadas,
            COALESCE(SUM(${ESTADOS.oculta}), 0) AS ocultas,
            COALESCE(SUM(${ESTADOS.retirada}), 0) AS retiradas
     FROM resenas r WHERE r.id_negocio = ?`,
    [id_negocio]
  );
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)]));
};

/** Reseñas del usuario (sin las que retiró), las más recientes primero. */
export const findDeUsuario = (id_usuario, opciones) =>
  pagina(["r.id_usuario = ?", "r.retirada_en IS NULL"], [id_usuario], { ...opciones, orden: "recientes" });

// ---------- Invitación a reseñar (recordatorios) ----------

/** Programa la invitación de la cita recién completada. */
export const insertInvitacion = async ({ id_cita, id_usuario, id_mascota, fecha }, conn) => {
  await conn.query(
    `INSERT INTO recordatorios (id_usuario, id_mascota, id_cita, tipo, titulo, mensaje, canal, fecha_programada)
     VALUES (?, ?, ?, 'resena_invitacion', 'Invitación a reseñar', 'Invitación a reseñar la cita completada', 'push', ?)`,
    [id_usuario, id_mascota, id_cita, fecha]
  );
};

/**
 * Invitaciones pendientes con `fecha_programada` en (desde, hasta], las más antiguas primero.
 * `desde` es el inicio del plazo para reseñar: una más antigua ya no sirve.
 */
export const findInvitacionesPendientes = async ({ desde, hasta, limite }) => {
  const [rows] = await db.query(
    `SELECT id_recordatorio, id_cita FROM recordatorios
     WHERE estado = 'pendiente' AND tipo = 'resena_invitacion'
       AND fecha_programada > ? AND fecha_programada <= ?
     ORDER BY fecha_programada, id_recordatorio
     LIMIT ?`,
    [desde, hasta, limite]
  );
  return rows;
};
