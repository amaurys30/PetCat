import { z } from "zod";
import { texto } from "../../shared/utils/schemas.js";

// Formato de Expo (Expo.isExpoPushToken): ExponentPushToken[...] o ExpoPushToken[...].
export const tokenExpo = z
  .string()
  .trim()
  .max(255)
  .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, "Debe ser un token de Expo Push (ExponentPushToken[...])");

export const registrarDispositivoBody = z.strictObject({
  token_expo: tokenExpo,
  plataforma: z.enum(["ios", "android"], { error: "Debe ser ios o android" }),
  nombre: texto(100).optional(),
});

export const quitarDispositivoBody = z.strictObject({ token_expo: tokenExpo });
