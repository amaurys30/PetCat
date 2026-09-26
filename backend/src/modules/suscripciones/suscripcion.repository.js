import pool from "../../config/db.js";
import { ApiError } from "../../shared/errors/ApiError.js";

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
