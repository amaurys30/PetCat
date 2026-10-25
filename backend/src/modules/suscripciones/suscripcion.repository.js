import pool from "../../config/db.js";
import { ApiError } from "../../shared/errors/ApiError.js";

const COLUMNAS_SUSCRIPCION = `id_suscripcion, id_negocio, id_plan, tipo_facturacion, estado, fecha_inicio,
  fecha_fin, fecha_prueba_fin, auto_renovar, monto_pagado, notas, id_usuario_registro, fecha_creacion`;

/** Suscripción al plan Gratuito sin vencimiento (fecha_fin 9999-12-31). */
export const createGratuita = async (id_negocio, conn) => {
  const [result] = await (conn ?? pool).query(
    `INSERT INTO suscripciones (id_negocio, id_plan, tipo_facturacion, estado, fecha_inicio, fecha_fin)
     SELECT ?, id_plan, 'mensual', 'activa', CURDATE(), '9999-12-31'
     FROM planes_suscripcion WHERE nombre = 'Gratuito'`,
    [id_negocio]
  );
  if (result.affectedRows !== 1) throw ApiError.internal("No existe el plan Gratuito");
  return result.insertId;
};

// ---------- Planes ----------

export const findPlanesActivos = async () => {
  const [rows] = await pool.query("SELECT * FROM planes_suscripcion WHERE activo = TRUE ORDER BY orden_display, id_plan");
  return rows;
};

/** Todos los planes (también inactivos: un negocio puede seguir en uno retirado). */
export const findAllPlanes = async (conn) => {
  const [rows] = await (conn ?? pool).query("SELECT * FROM planes_suscripcion ORDER BY orden_display, id_plan");
  return rows;
};

export const findPlanById = async (id_plan, conn) => {
  const [rows] = await (conn ?? pool).query("SELECT * FROM planes_suscripcion WHERE id_plan = ?", [id_plan]);
  return rows[0];
};

export const findPlanByNombre = async (nombre, conn) => {
  const [rows] = await (conn ?? pool).query("SELECT * FROM planes_suscripcion WHERE nombre = ?", [nombre]);
  return rows[0];
};

// ---------- Suscripciones ----------

/** Todas las suscripciones del negocio, de la más antigua a la más reciente. */
export const findByNegocio = async (id_negocio, conn) => {
  const [rows] = await (conn ?? pool).query(
    `SELECT ${COLUMNAS_SUSCRIPCION} FROM suscripciones WHERE id_negocio = ? ORDER BY id_suscripcion`,
    [id_negocio]
  );
  return rows;
};

/**
 * Como findByNegocio, pero bloquea las filas (FOR UPDATE). Es una lectura con
 * bloqueo, así que no fija la foto de la transacción. Solo lee `suscripciones`
 * (sin JOIN) para no bloquear la fila del plan, que comparten todos los negocios.
 */
export const lockByNegocio = async (id_negocio, conn) => {
  const [rows] = await conn.query(
    `SELECT ${COLUMNAS_SUSCRIPCION} FROM suscripciones WHERE id_negocio = ? ORDER BY id_suscripcion FOR UPDATE`,
    [id_negocio]
  );
  return rows;
};

/** Suscripciones de varios negocios, agrupadas por id_negocio. */
export const findByNegocios = async (ids) => {
  if (ids.length === 0) return {};
  const [rows] = await pool.query(
    `SELECT ${COLUMNAS_SUSCRIPCION} FROM suscripciones WHERE id_negocio IN (?) ORDER BY id_suscripcion`,
    [ids]
  );
  const porNegocio = {};
  for (const row of rows) (porNegocio[row.id_negocio] ??= []).push(row);
  return porNegocio;
};

/**
 * Negocios con una suscripción vigente que ya venció o con una prueba que termina en los
 * próximos `diasAviso` días (para el job de suscripciones). Sin bloqueo.
 */
export const findNegociosPorRevisar = async (hoy, diasAviso, limite) => {
  const [rows] = await pool.query(
    `SELECT DISTINCT id_negocio FROM suscripciones
     WHERE estado IN ('activa', 'en_prueba')
       AND (fecha_fin < ? OR (estado = 'en_prueba' AND fecha_prueba_fin <= ? + INTERVAL ? DAY))
     ORDER BY id_negocio
     LIMIT ?`,
    [hoy, hoy, diasAviso, limite]
  );
  return rows.map((row) => row.id_negocio);
};

/** Cierra la suscripción vigente al cambiar de plan: `vencida` si ya había vencido, si no `cancelada` desde hoy. */
export const cerrar = async (suscripcion, vencida, conn) => {
  await conn.query(
    vencida
      ? "UPDATE suscripciones SET estado = 'vencida' WHERE id_suscripcion = ?"
      : "UPDATE suscripciones SET estado = 'cancelada', fecha_fin = CURDATE() WHERE id_suscripcion = ?",
    [suscripcion.id_suscripcion]
  );
};

/** Prueba Pro: `en_prueba` desde hoy, con fin de prueba y de suscripción a los `dias` días. */
/** `id_usuario_registro`: quien activó la prueba (el propietario o el admin). */
export const createPrueba = async (id_negocio, id_plan, dias, id_usuario_registro, conn) => {
  const [result] = await conn.query(
    `INSERT INTO suscripciones (id_negocio, id_plan, tipo_facturacion, estado, fecha_inicio, fecha_fin,
                                fecha_prueba_fin, auto_renovar, notas, id_usuario_registro)
     VALUES (?, ?, 'mensual', 'en_prueba', CURDATE(), CURDATE() + INTERVAL ? DAY, CURDATE() + INTERVAL ? DAY,
             FALSE, ?, ?)`,
    [id_negocio, id_plan, dias, dias, `Prueba gratuita de ${dias} días`, id_usuario_registro]
  );
  return result.insertId;
};

/**
 * Plan asignado por el admin, `activa` desde hoy. Sin `fecha_fin`, dura un mes o un
 * año según la facturación; el Gratuito no vence (9999-12-31).
 */
export const createAsignada = async (
  id_negocio,
  { plan, tipo_facturacion, fecha_fin, monto_pagado, notas, id_usuario_registro },
  conn
) => {
  const [result] = await conn.query(
    `INSERT INTO suscripciones (id_negocio, id_plan, tipo_facturacion, estado, fecha_inicio, fecha_fin,
                                auto_renovar, monto_pagado, notas, id_usuario_registro)
     VALUES (?, ?, ?, 'activa', CURDATE(),
             CASE WHEN ? THEN '9999-12-31'
                  WHEN ? IS NOT NULL THEN ?
                  WHEN ? = 'anual' THEN CURDATE() + INTERVAL 1 YEAR
                  ELSE CURDATE() + INTERVAL 1 MONTH END,
             FALSE, ?, ?, ?)`,
    [
      id_negocio,
      plan.id_plan,
      tipo_facturacion,
      plan.nombre === "Gratuito",
      fecha_fin ?? null,
      fecha_fin ?? null,
      tipo_facturacion,
      monto_pagado,
      notas ?? null,
      id_usuario_registro,
    ]
  );
  return result.insertId;
};

// ---------- Uso de los límites ----------

export const countSucursalesActivas = async (id_negocio, conn) => {
  const [[row]] = await (conn ?? pool).query(
    "SELECT COUNT(*) AS total FROM sucursales WHERE id_negocio = ? AND activo = TRUE",
    [id_negocio]
  );
  return row.total;
};

/** Empleados activos sin contar al propietario registrado como empleado de su negocio. */
export const countEmpleadosActivos = async (id_negocio, conn) => {
  const [[row]] = await (conn ?? pool).query(
    `SELECT COUNT(*) AS total
     FROM empleados e
     JOIN negocios n ON n.id_negocio = e.id_negocio
     WHERE e.id_negocio = ? AND e.activo = TRUE
       AND (e.id_usuario IS NULL OR e.id_usuario <> n.id_usuario_propietario)`,
    [id_negocio]
  );
  return row.total;
};

/** Citas del negocio en el mes calendario de `fecha`, excepto canceladas y reprogramadas. */
export const countCitasMes = async (id_negocio, fecha, excluirIdCita = 0, conn) => {
  const [[row]] = await (conn ?? pool).query(
    `SELECT COUNT(*) AS total FROM citas
     WHERE id_negocio = ?
       AND fecha BETWEEN DATE_FORMAT(?, '%Y-%m-01') AND LAST_DAY(?)
       AND estado NOT IN ('cancelada', 'reprogramada')
       AND id_cita <> ?`,
    [id_negocio, fecha, fecha, excluirIdCita]
  );
  return row.total;
};

export const countProductosActivos = async (id_negocio, conn) => {
  const [[row]] = await (conn ?? pool).query(
    "SELECT COUNT(*) AS total FROM productos WHERE id_negocio = ? AND activo = TRUE",
    [id_negocio]
  );
  return row.total;
};

/**
 * Historial de suscripciones del negocio, de la más reciente a la más antigua, con el plan
 * y quién la creó (admin o propietario; null en la Gratuita automática).
 */
export const findHistorial = async (id_negocio) => {
  const [rows] = await pool.query(
    `SELECT s.id_suscripcion, s.estado, s.tipo_facturacion, s.fecha_inicio, s.fecha_fin, s.fecha_prueba_fin,
            s.monto_pagado, s.notas, s.fecha_creacion,
            p.id_plan, p.nombre AS plan_nombre,
            u.id_usuario AS registro_id, u.nombre AS registro_nombre, u.apellido AS registro_apellido,
            u.email AS registro_email, u.tipo_usuario AS registro_tipo
     FROM suscripciones s
     JOIN planes_suscripcion p ON p.id_plan = s.id_plan
     LEFT JOIN usuarios u ON u.id_usuario = s.id_usuario_registro
     WHERE s.id_negocio = ?
     ORDER BY s.id_suscripcion DESC`,
    [id_negocio]
  );
  return rows;
};
