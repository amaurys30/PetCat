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

/**
 * Para PATCH: el body debe traer al menos un campo. Solo se evalúa si no hubo
 * otros errores (un body con solo campos no permitidos ya los reporta).
 */
export const conAlMenosUnCampo = (schema) =>
  schema.refine((data) => Object.keys(data).length > 0, {
    message: "Envía al menos un campo para actualizar",
    path: [],
    when: (payload) => payload.issues.length === 0,
  });

/** Email normalizado (sin espacios y en minúsculas) antes de validar. */
export const email = z.string().trim().toLowerCase().pipe(z.email().max(150));

/** URL http o https (sin javascript:, data:, etc.). */
export const urlHttp = (max = 500) => z.url({ protocol: /^https?$/ }).max(max);

/** Texto con espacios recortados, no vacío. */
export const texto = (max) => z.string().trim().min(1).max(max);
