// ===============================
// src/modules/horarios/horario.repository.js
// ===============================

import pool from "../../config/db.js";

export const findBySucursalAndDia = async (
  id_sucursal,
  dia_semana
) => {
  const [rows] = await pool.query(
    `
    SELECT *
    FROM horarios_negocio
    WHERE id_sucursal = ?
      AND dia_semana = ?
      AND activo = true
    LIMIT 1
    `,
    [id_sucursal, dia_semana]
  );

  return rows[0] || null;
};

export const create = async ({
  id_sucursal,
  dia_semana,
  hora_apertura,
  hora_cierre
}) => {
  const [result] = await pool.query(
    `
    INSERT INTO horarios_negocio (
      id_sucursal,
      dia_semana,
      hora_apertura,
      hora_cierre,
      activo
    )
    VALUES (?, ?, ?, ?, true)
    `,
    [
      id_sucursal,
      dia_semana,
      hora_apertura,
      hora_cierre
    ]
  );

  const [rows] = await pool.query(
    `
    SELECT
      id_horario,
      id_sucursal,
      dia_semana,
      hora_apertura,
      hora_cierre,
      activo
    FROM horarios_negocio
    WHERE id_horario = ?
    `,
    [result.insertId]
  );

  return rows[0];
};
