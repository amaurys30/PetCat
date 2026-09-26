import { ZodError } from "zod";
import { ApiError } from "../errors/ApiError.js";
import { sendError } from "../utils/response.js";
import { formatZodError } from "../utils/zodErrors.js";
import { isProduction, isTest } from "../../config/env.js";

// Nombre de la columna en los mensajes de MySQL: "... for column 'nombre' at row 1".
const columnFrom = (err) => /column '([^']+)'/i.exec(err.sqlMessage ?? "")?.[1];

const withColumn = (column, detail) => (column ? { [column]: detail } : undefined);

/**
 * Traduce errores de MySQL a { status, message, errors }. Devuelve null si no es uno conocido.
 */
const fromMysql = (err) => {
  const column = columnFrom(err);

  switch (err.code) {
    case "ER_DUP_ENTRY":
      return { status: 409, message: "Ya existe un registro con esos datos" };

    case "ER_ROW_IS_REFERENCED":
    case "ER_ROW_IS_REFERENCED_2":
      return {
        status: 409,
        message: "No se puede eliminar o modificar: hay otros registros que dependen de este",
      };

    case "ER_NO_REFERENCED_ROW":
    case "ER_NO_REFERENCED_ROW_2":
      return { status: 400, message: "Uno de los registros relacionados no existe" };

    case "ER_DATA_TOO_LONG":
      return {
        status: 400,
        message: column ? `El valor de '${column}' es demasiado largo` : "Un valor es demasiado largo",
        errors: withColumn(column, "Demasiado largo"),
      };

    case "WARN_DATA_TRUNCATED":
      return {
        status: 400,
        message: column ? `Valor no permitido para '${column}'` : "Un valor no está permitido",
        errors: withColumn(column, "Valor no permitido"),
      };

    case "ER_TRUNCATED_WRONG_VALUE":
    case "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD":
      return {
        status: 400,
        message: column ? `Formato inválido para '${column}'` : "Un valor tiene formato inválido",
        errors: withColumn(column, "Formato inválido"),
      };

    case "ER_WARN_DATA_OUT_OF_RANGE":
      return {
        status: 400,
        message: column ? `El valor de '${column}' está fuera de rango` : "Un valor está fuera de rango",
        errors: withColumn(column, "Fuera de rango"),
      };

    case "ER_BAD_NULL_ERROR":
      return {
        status: 400,
        message: column ? `El campo '${column}' es obligatorio` : "Falta un campo obligatorio",
        errors: withColumn(column, "Obligatorio"),
      };

    default:
      return null;
  }
};

// Express reconoce el middleware de errores por sus 4 parámetros.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof ApiError) {
    return sendError(res, err.status, err.message, err.errors);
  }

  if (err instanceof ZodError) {
    return sendError(res, 422, "Datos inválidos", formatZodError(err));
  }

  // Errores de express.json()
  if (err.type === "entity.parse.failed") {
    return sendError(res, 400, "El cuerpo de la solicitud no es un JSON válido");
  }
  if (err.type === "entity.too.large") {
    return sendError(res, 413, "El cuerpo de la solicitud es demasiado grande");
  }

  const mysql = fromMysql(err);
  if (mysql) return sendError(res, mysql.status, mysql.message, mysql.errors);

  if (!isTest) console.error(err);

  return sendError(
    res,
    500,
    "Error interno del servidor",
    isProduction ? undefined : { servidor: err.message }
  );
};

export default errorHandler;
