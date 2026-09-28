import { z } from "zod";
import { fecha, texto } from "../../shared/utils/schemas.js";
import { hoyISO } from "../../shared/utils/fechas.js";

export const asignarPlanBody = z.strictObject({
  id_plan: z.number().int().positive(),
  tipo_facturacion: z.enum(["mensual", "anual"], { error: "Debe ser mensual o anual" }).default("mensual"),
  fecha_fin: fecha.refine((valor) => valor > hoyISO(), "Debe ser una fecha futura").optional(),
  monto_pagado: z.number().min(0).max(9_999_999_999).default(0),
  notas: texto(300).optional(),
});
