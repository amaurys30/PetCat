import { z } from "zod";

// El token del enlace: 32 bytes en hexadecimal.
export const tokenParams = z.object({
  token: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, "Token de invitación inválido")
    .transform((token) => token.toLowerCase()),
});
