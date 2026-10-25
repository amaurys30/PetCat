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

const calificacionQuery = z.coerce.number().int().min(1, "Mínimo 1").max(5, "Máximo 5");

/** `calificacion` (exacta) y `calificacion_max` (de 1 hasta ese valor) no van juntas. */
const unaCalificacion = (q, ctx) => {
  if (q.calificacion !== undefined && q.calificacion_max !== undefined) {
    ctx.addIssue({ code: "custom", path: ["calificacion_max"], message: "Usa calificacion o calificacion_max, no las dos" });
  }
};

const publicasBase = paginationSchema.extend({
  orden: z.enum(ORDENES, { error: `Debe ser ${ORDENES.join(", ")}` }).default("recientes"),
  calificacion: calificacionQuery.optional(),
  calificacion_max: calificacionQuery.optional(),
});

export const publicasQuery = publicasBase.superRefine(unaCalificacion);

export const ESTADOS_PANEL = ["publicada", "oculta", "retirada"];

export const gestionQuery = publicasBase
  .extend({
    estado: z.enum(ESTADOS_PANEL, { error: `Debe ser ${ESTADOS_PANEL.join(", ")}` }).optional(),
    sin_responder: booleano.optional(),
    reportada: booleano.optional(),
    visible: booleano.optional(),
    id_resena: z.coerce.number().int().positive().optional(),
  })
  .superRefine(unaCalificacion);

export const misResenasQuery = paginationSchema;
