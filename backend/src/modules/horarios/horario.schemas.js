import { z } from "zod";
import { hora } from "../../shared/utils/schemas.js";

const rango = z
  .strictObject({
    dia_semana: z.int().min(0).max(6),
    hora_apertura: hora,
    hora_cierre: hora,
  })
  .refine((r) => r.hora_cierre > r.hora_apertura, {
    path: ["hora_cierre"],
    message: "Debe ser posterior a hora_apertura",
  });

/**
 * La semana completa de la sucursal. Los días sin rangos quedan cerrados.
 * Varios rangos el mismo día = horario partido (el servicio valida que no se crucen).
 */
export const putHorariosBody = z.strictObject({
  horarios: z.array(rango).max(42),
});
