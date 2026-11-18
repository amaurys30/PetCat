import { z } from "zod";

// Mismas reglas que la API (backend/src/modules/auth/auth.schemas.js), con mensajes para la app.

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Escribe tu correo")
  .max(150, "Máximo 150 caracteres")
  .pipe(z.email({ error: "Escribe un correo válido, como nombre@correo.com" }));

const nombre = (campo: string) =>
  z.string().trim().min(2, `Escribe tu ${campo} (mínimo 2 letras)`).max(80, "Máximo 80 caracteres");

export const passwordNuevaSchema = z
  .string()
  .min(8, "Usa al menos 8 caracteres")
  .max(72, "Máximo 72 caracteres")
  .regex(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/, "Incluye al menos una letra")
  .regex(/\d/, "Incluye al menos un número");

export const codigoSchema = z.string().regex(/^\d{6}$/, "Escribe los 6 dígitos del código");

export const registroSchema = z.object({
  nombre: nombre("nombre"),
  apellido: nombre("apellido"),
  email: emailSchema,
  password: passwordNuevaSchema,
  acepta_politica_datos: z
    .boolean()
    .refine((v) => v, "Para crear tu cuenta debes aceptar la política de datos"),
});
export type RegistroForm = z.infer<typeof registroSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Escribe tu contraseña"),
});
export type LoginForm = z.infer<typeof loginSchema>;

export const recuperarSchema = z.object({ email: emailSchema });
export type RecuperarForm = z.infer<typeof recuperarSchema>;

export const restablecerSchema = z.object({ codigo: codigoSchema, password: passwordNuevaSchema });
export type RestablecerForm = z.infer<typeof restablecerSchema>;

export const verificarSchema = z.object({ codigo: codigoSchema });
export type VerificarForm = z.infer<typeof verificarSchema>;
