import { z } from "zod";
import { idParam, texto } from "../../shared/utils/schemas.js";
import { paginationSchema } from "../../shared/utils/pagination.js";

export const idResenaParams = idParam("id_resena");

const estrellas = z.number().int().min(1, "Mínimo 1").max(5, "Máximo 5");

/**
 * Reseña del dueño (crear y editar). Al editar reemplaza la reseña completa: lo que no
 * se envía queda vacío.
 */
export const resenaBody = z.strictObject({
  calificacion: estrellas,
  titulo: texto(150).optional(),
  comentario: texto(1000).optional(),
  aspectos: z
    .strictObject({
      atencion: estrellas.optional(),
      precio: estrellas.optional(),
      instalaciones: estrellas.optional(),
      puntualidad: estrellas.optional(),
    })
    .optional(),
});

export const respuestaBody = z.strictObject({ respuesta: texto(1000) });

export const MOTIVOS_REPORTE = ["lenguaje_ofensivo", "datos_personales", "no_relacionada", "spam", "otro"];

export const reporteBody = z
  .strictObject({
    motivo: z.enum(MOTIVOS_REPORTE, { error: `Debe ser uno de: ${MOTIVOS_REPORTE.join(", ")}` }),
    detalle: texto(500).optional(),
  })
  .refine((data) => data.motivo !== "otro" || data.detalle, {
    message: "Describe el motivo cuando es otro",
    path: ["detalle"],
  });

const booleano = z
  .enum(["true", "false"], { error: "Debe ser true o false" })
  .transform((valor) => valor === "true");

export const ORDENES = ["recientes", "mejores", "peores"];

export const publicasQuery = paginationSchema.extend({
  orden: z.enum(ORDENES, { error: `Debe ser ${ORDENES.join(", ")}` }).default("recientes"),
  calificacion: z.coerce.number().int().min(1).max(5).optional(),
});

export const gestionQuery = publicasQuery.extend({
  sin_responder: booleano.optional(),
  reportada: booleano.optional(),
  visible: booleano.optional(),
});

export const misResenasQuery = paginationSchema;
