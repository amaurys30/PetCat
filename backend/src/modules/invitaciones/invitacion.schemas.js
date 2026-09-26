import { z } from "zod";
import { telefono } from "../../shared/utils/schemas.js";

// El token del enlace: 32 bytes en hexadecimal.
export const tokenParams = z.object({
  token: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, "Token de invitación inválido")
    .transform((token) => token.toLowerCase()),
});

const nombre = z.string().trim().min(2).max(80);

/**
 * Aceptar. Con cuenta existente solo se usa `password` (la contraseña actual).
 * Sin cuenta, `password` es la nueva (reglas del registro, se validan en el
 * servicio) y nombre, apellido y teléfono son opcionales: por defecto, los del empleado.
 */
export const aceptarBody = z.strictObject({
  password: z.string().min(1).max(200),
  nombre: nombre.optional(),
  apellido: nombre.optional(),
  telefono: telefono.optional(),
});
