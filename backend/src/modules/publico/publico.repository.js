import db from "../../config/db.js";

/**
 * Conteos agregados de la plataforma (sin datos personales):
 * - negocios activos con al menos una sucursal activa (los que aparecen en la búsqueda),
 * - ciudades distintas de sus sucursales activas,
 * - citas completadas.
 */
export const findEstadisticas = async () => {
  const [[negocios]] = await db.query(
    `SELECT COUNT(DISTINCT n.id_negocio) AS negocios_activos, COUNT(DISTINCT s.ciudad) AS ciudades
     FROM negocios n
     JOIN sucursales s ON s.id_negocio = n.id_negocio AND s.activo = TRUE
     WHERE n.activo = TRUE`
  );
  const [[citas]] = await db.query("SELECT COUNT(*) AS citas_atendidas FROM citas WHERE estado = 'completada'");
  return { ...negocios, ...citas };
};

/**
 * Reseñas que se pueden mostrar en la landing: visibles, sin reporte, no retiradas, de 4 o 5
 * estrellas, con comentario, de una cita completada (visita verificada), de un negocio activo y
 * de un autor que no registró el mismo negocio desde el panel (señal de moderación).
 */
const ELEGIBLES = `
  FROM resenas r
  JOIN citas c ON c.id_cita = r.id_cita AND c.estado = 'completada'
  JOIN negocios n ON n.id_negocio = r.id_negocio AND n.activo = TRUE
  JOIN usuarios u ON u.id_usuario = r.id_usuario
  WHERE r.visible = TRUE AND r.reportada = FALSE AND r.retirada_en IS NULL
    AND r.cliente_registrado_por_negocio = FALSE
    AND r.calificacion >= 4
    AND r.comentario IS NOT NULL AND TRIM(r.comentario) <> ''`;

export const countResenasElegibles = async () => {
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${ELEGIBLES}`);
  return total;
};

/** Las más recientes, con un máximo de `porNegocio` de cada negocio para que haya variedad. */
export const findResenasElegibles = async ({ limit, porNegocio }) => {
  const [rows] = await db.query(
    `SELECT id_resena, calificacion, titulo, comentario, autor_nombre, autor_apellido,
            id_negocio, negocio_nombre, negocio_tipo, cita_fecha
     FROM (
       SELECT r.id_resena, r.calificacion, r.titulo, r.comentario, r.fecha_creacion,
              u.nombre AS autor_nombre, u.apellido AS autor_apellido,
              n.id_negocio, n.nombre AS negocio_nombre, n.tipo AS negocio_tipo, c.fecha AS cita_fecha,
              ROW_NUMBER() OVER (PARTITION BY r.id_negocio ORDER BY r.fecha_creacion DESC, r.id_resena DESC) AS orden
       ${ELEGIBLES}
     ) t
     WHERE orden <= ?
     ORDER BY fecha_creacion DESC, id_resena DESC
     LIMIT ?`,
    [porNegocio, limit]
  );
  return rows;
};
