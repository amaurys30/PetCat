import { z } from "zod";

/**
 * Piezas de esquemas Zod que se repiten entre módulos.
 */

/** `{ [name]: entero positivo }` para req.params: `validate({ params: idParam("id_negocio") })`. */
export const idParam = (name) => z.object({ [name]: z.coerce.number().int().positive() });

export const telefono = z
  .string()
  .trim()
  .regex(/^\+?[\d\s-]{7,20}$/, "Teléfono inválido");

export const latitud = z.number().min(-90).max(90);
export const longitud = z.number().min(-180).max(180);

/** Latitud y longitud van juntas: una sin la otra es un error en el campo que falta. */
export const coordenadasJuntas = (data, ctx) => {
  const { latitud: lat, longitud: lng } = data;
  if (lat === undefined && lng === undefined) return;
  // Ambas con valor, o ambas en null (quitar la ubicación).
  const faltante =
    lat === undefined || (lat === null && lng !== null) ? "latitud"
    : lng === undefined || (lng === null && lat !== null) ? "longitud"
    : null;
  if (faltante) {
    ctx.addIssue({ code: "custom", path: [faltante], message: "Latitud y longitud deben enviarse juntas" });
  }
};

/** Para PATCH: el body debe traer al menos un campo. */
export const alMenosUnCampo = (data, ctx) => {
  if (Object.keys(data).length === 0) {
    ctx.addIssue({ code: "custom", path: [], message: "Envía al menos un campo para actualizar" });
  }
};
