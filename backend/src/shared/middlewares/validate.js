import { ApiError } from "../errors/ApiError.js";
import { formatZodError } from "../utils/zodErrors.js";

const PARTS = ["params", "query", "body"];

/**
 * Valida req.params, req.query y req.body con esquemas Zod y los reemplaza por
 * los datos parseados (con coerciones y valores por defecto aplicados).
 * Si algo falla responde 422 con { errors: { campo: "mensaje" } }.
 *
 *   router.patch("/:id_empleado", validate({ params: idEmpleadoParams, body: updateEmpleadoBody }), ...)
 */
export const validate = (schemas) => (req, res, next) => {
  const errors = {};

  for (const part of PARTS) {
    const schema = schemas[part];
    if (!schema) continue;

    const result = schema.safeParse(req[part] ?? {});
    if (!result.success) {
      for (const [field, message] of Object.entries(formatZodError(result.error))) {
        if (!(field in errors)) errors[field] = message;
      }
      continue;
    }

    // En Express 5 req.query es un getter de solo lectura: se redefine en la petición.
    Object.defineProperty(req, part, {
      value: result.data,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }

  if (Object.keys(errors).length > 0) {
    return next(ApiError.unprocessable("Datos inválidos", errors));
  }
  next();
};

export default validate;
