import { z } from "zod";
import { fecha } from "../../shared/utils/schemas.js";
import { diasEntre, hoyISO } from "../../shared/utils/fechas.js";
import { RANGO_AVANZADO_DIAS } from "./dashboard.service.js";

const DIAS_POR_DEFECTO = 30;

const restarDias = (valor, dias) => {
  const d = new Date(`${valor}T12:00:00`);
  d.setDate(d.getDate() - dias);
  return hoyISO(d);
};

/**
 * Rango del dashboard: por defecto los últimos 30 días hasta hoy. `hasta` no puede ser
 * futuro. El máximo según el plan (92 o 366 días) lo comprueba el servicio; aquí solo el
 * absoluto.
 */
export const dashboardQuery = z
  .object({
    desde: fecha.optional(),
    hasta: fecha.optional(),
    id_sucursal: z.coerce.number().int().positive().optional(),
  })
  .transform((q) => {
    const hasta = q.hasta ?? hoyISO();
    return { ...q, hasta, desde: q.desde ?? restarDias(hasta, DIAS_POR_DEFECTO - 1) };
  })
  .superRefine((q, ctx) => {
    if (q.hasta > hoyISO()) {
      ctx.addIssue({ code: "custom", path: ["hasta"], message: "No puede ser posterior a hoy: lo que viene está en la agenda" });
    } else if (q.desde > q.hasta) {
      ctx.addIssue({ code: "custom", path: ["desde"], message: "No puede ser posterior a hasta" });
    } else if (diasEntre(q.desde, q.hasta) + 1 > RANGO_AVANZADO_DIAS) {
      ctx.addIssue({ code: "custom", path: ["hasta"], message: `El rango máximo es de ${RANGO_AVANZADO_DIAS} días` });
    }
  });
