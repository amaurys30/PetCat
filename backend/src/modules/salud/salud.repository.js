import db from "../../config/db.js";
import { SELECT_CITA } from "./cita-resumen.js";

// Consultas en lote del resumen de salud de varias mascotas a la vez (una consulta por tipo
// de dato, no una por mascota). Solo SQL. Las usa el dueño: ven todo lo de sus mascotas.

/** Vacunas de las mascotas, con lo necesario para calcular su estado. */
export const findVacunasDeMascotas = async (ids) => {
  const [rows] = await db.query(
    `SELECT id_vacuna, id_mascota, nombre_vacuna, fecha_aplicacion, fecha_proxima
     FROM vacunas WHERE id_mascota IN (?)`,
    [ids]
  );
  return rows;
};

/** Registros médicos con próximo control (o desparasitación) entre `desde` y `hasta`. */
export const findControlesDeMascotas = async (ids, desde, hasta) => {
  const [rows] = await db.query(
    `SELECT h.id_historial, h.id_mascota, h.tipo, h.proximo_control, h.id_negocio, n.nombre AS negocio_nombre
     FROM historial_medico h
     LEFT JOIN negocios n ON n.id_negocio = h.id_negocio
     WHERE h.id_mascota IN (?) AND h.proximo_control BETWEEN ? AND ?`,
    [ids, desde, hasta]
  );
  return rows;
};

/** La próxima cita pendiente o confirmada de cada mascota (la que aún no termina), de cualquier negocio. */
export const findProximasCitasDeMascotas = async (ids) => {
  const [rows] = await db.query(
    `SELECT * FROM (
       SELECT x.*, ROW_NUMBER() OVER (PARTITION BY x.id_mascota ORDER BY x.fecha, x.hora_inicio) AS n
       FROM (
         ${SELECT_CITA}
         WHERE c.id_mascota IN (?) AND c.estado IN ('pendiente', 'confirmada')
           AND (c.fecha > CURDATE() OR (c.fecha = CURDATE() AND c.hora_fin >= CURTIME()))
       ) x
     ) ordenadas
     WHERE n = 1`,
    [ids]
  );
  return rows;
};
