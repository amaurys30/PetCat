import { z } from "zod";
import { MAX_DETALLE_REPORTE, MAX_RESPUESTA } from "./textos";

export const respuestaSchema = z.object({
  respuesta: z
    .string()
    .trim()
    .min(1, "Escribe la respuesta")
    .max(MAX_RESPUESTA, `Máximo ${MAX_RESPUESTA} caracteres`),
});
export type RespuestaValores = z.infer<typeof respuestaSchema>;

/** Igual que la API: con el motivo "otro", el detalle es obligatorio. */
export const reporteSchema = z
  .object({
    motivo: z.enum(["lenguaje_ofensivo", "datos_personales", "no_relacionada", "spam", "otro"], {
      error: "Elige un motivo",
    }),
    detalle: z.string().trim().max(MAX_DETALLE_REPORTE, `Máximo ${MAX_DETALLE_REPORTE} caracteres`),
  })
  .refine((v) => v.motivo !== "otro" || v.detalle.length > 0, {
    message: "Describe el motivo",
    path: ["detalle"],
  });
export type ReporteValores = z.infer<typeof reporteSchema>;
