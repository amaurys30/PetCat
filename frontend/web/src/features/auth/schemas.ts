import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Escribe tu correo").email("Correo electrónico inválido"),
  password: z.string().min(1, "Escribe tu contraseña"),
  recordar: z.boolean(),
});
export type LoginValores = z.infer<typeof loginSchema>;

export const recuperarSchema = z.object({
  email: z.string().trim().min(1, "Escribe tu correo").email("Correo electrónico inválido"),
});
export type RecuperarValores = z.infer<typeof recuperarSchema>;

/** Mismas reglas que la API (passwordNueva en backend/src/modules/auth/auth.schemas.js). */
export const REGLAS_PASSWORD = [
  { texto: "Entre 8 y 72 caracteres", cumple: (v: string) => v.length >= 8 && v.length <= 72 },
  {
    texto: "Al menos una letra y un número",
    cumple: (v: string) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(v) && /\d/.test(v),
  },
] as const;

export const passwordNuevaSchema = z
  .object({
    password: z
      .string()
      .min(8, "Debe tener al menos 8 caracteres")
      .max(72, "Debe tener máximo 72 caracteres")
      .regex(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/, "Debe incluir al menos una letra")
      .regex(/\d/, "Debe incluir al menos un número"),
    confirmacion: z.string().min(1, "Repite la contraseña"),
  })
  .refine((v) => v.password === v.confirmacion, {
    path: ["confirmacion"],
    message: "Las contraseñas no coinciden",
  });
export type PasswordNuevaValores = z.infer<typeof passwordNuevaSchema>;
