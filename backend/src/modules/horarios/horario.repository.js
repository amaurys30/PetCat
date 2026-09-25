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

/** Reemplaza todos los rangos de la sucursal. Usar dentro de una transacción. */
export const replaceBySucursal = async (id_sucursal, rangos, conn) => {
  await conn.query("DELETE FROM horarios_negocio WHERE id_sucursal = ?", [id_sucursal]);
  if (rangos.length === 0) return;
  await conn.query(
    "INSERT INTO horarios_negocio (id_sucursal, dia_semana, hora_apertura, hora_cierre) VALUES ?",
    [rangos.map((r) => [id_sucursal, r.dia_semana, r.hora_apertura, r.hora_cierre])]
  );
};
