import db from "../../config/db.js";

export const create = async (data) => {
  const [result] = await db.query(
    `
    INSERT INTO invitaciones_empleado (
      id_empleado, id_negocio, email,
      token, expiracion
    )
    VALUES (?, ?, ?, ?, ?)
    `,
    [
      data.id_empleado,
      data.id_negocio,
      data.email,
      data.token,
      data.expiracion
    ]
  );

  return result.insertId;
};

export const findByToken = async (token) => {
  const [rows] = await db.query(
    `SELECT * FROM invitaciones_empleado WHERE token = ? LIMIT 1`,
    [token]
  );

  return rows[0];
};

export const invalidatePrevious = async (id_empleado) => {
  await db.query(
    `
    UPDATE invitaciones_empleado
    SET expiracion = NOW()
    WHERE id_empleado = ? AND usado = FALSE
    `,
    [id_empleado]
  );
};

export const markAsUsed = async (id_invitacion) => {
  await db.query(
    `
    UPDATE invitaciones_empleado
    SET usado = TRUE, fecha_usado = NOW()
    WHERE id_invitacion = ?
    `,
    [id_invitacion]
  );
};