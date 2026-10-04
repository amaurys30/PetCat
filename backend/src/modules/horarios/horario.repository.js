import pool from "../../config/db.js";

export const findBySucursal = async (id_sucursal, conn) => {
  const [rows] = await (conn ?? pool).query(
    `SELECT id_horario, dia_semana,
            TIME_FORMAT(hora_apertura, '%H:%i') AS hora_apertura,
            TIME_FORMAT(hora_cierre, '%H:%i') AS hora_cierre
     FROM horarios_negocio
     WHERE id_sucursal = ? AND activo = TRUE
     ORDER BY dia_semana, hora_apertura`,
    [id_sucursal]
  );
  return rows;
};

/**
 * Reemplaza todos los rangos de la sucursal. Usar dentro de una transacción, con la fila de
 * la sucursal ya bloqueada. Borra por clave primaria: un DELETE por id_sucursal sobre una
 * sede sin horarios toma un gap lock que comparten sedes con ids seguidos (deadlock).
 */
export const replaceBySucursal = async (id_sucursal, rangos, conn) => {
  const [actuales] = await conn.query("SELECT id_horario FROM horarios_negocio WHERE id_sucursal = ?", [id_sucursal]);
  if (actuales.length > 0) {
    await conn.query("DELETE FROM horarios_negocio WHERE id_horario IN (?)", [actuales.map((h) => h.id_horario)]);
  }
  if (rangos.length === 0) return;
  await conn.query(
    "INSERT INTO horarios_negocio (id_sucursal, dia_semana, hora_apertura, hora_cierre) VALUES ?",
    [rangos.map((r) => [id_sucursal, r.dia_semana, r.hora_apertura, r.hora_cierre])]
  );
};
