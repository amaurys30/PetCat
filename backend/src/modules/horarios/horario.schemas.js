import { z } from "zod";

// "08:00" o "08:00:00"; se guarda siempre con segundos.
const hora = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Hora inválida: usa HH:MM (00:00 a 23:59)")
  .transform((valor) => (valor.length === 5 ? `${valor}:00` : valor));

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
