import { z } from "zod";

const email = z.string().trim().min(1, "Escribe tu correo").email("Correo electrónico inválido");

/** Mismas reglas que la API (passwordNueva en backend/src/modules/auth/auth.schemas.js). */
export const passwordNueva = z
  .string()
  .min(8, "Debe tener al menos 8 caracteres")
  .max(72, "Debe tener máximo 72 caracteres")
  .regex(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/, "Debe incluir al menos una letra")
  .regex(/\d/, "Debe incluir al menos un número");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Escribe tu contraseña"),
  recordar: z.boolean(),
});
export type LoginValores = z.infer<typeof loginSchema>;

/** Un solo correo: recuperar la contraseña o pedir otro enlace de verificación. */
export const emailSchema = z.object({ email });
export type EmailValores = z.infer<typeof emailSchema>;

/** Reglas de la contraseña nueva que se marcan a medida que se escribe. */
export const REGLAS_PASSWORD = [
  { texto: "Entre 8 y 72 caracteres", cumple: (v: string) => v.length >= 8 && v.length <= 72 },
  {
    texto: "Al menos una letra y un número",
    cumple: (v: string) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(v) && /\d/.test(v),
  },
] as const;

export const passwordNuevaSchema = z
  .object({
    password: passwordNueva,
    confirmacion: z.string().min(1, "Repite la contraseña"),
  })
  .refine((v) => v.password === v.confirmacion, {
    path: ["confirmacion"],
    message: "Las contraseñas no coinciden",
  });
export type PasswordNuevaValores = z.infer<typeof passwordNuevaSchema>;

export const nombre = z
  .string()
  .trim()
  .min(2, "Debe tener al menos 2 caracteres")
  .max(80, "Debe tener máximo 80 caracteres");

/** A7 · Crear cuenta. El teléfono es opcional: vacío no se envía. */
export const registroSchema = z.object({
  nombre,
  apellido: nombre,
  email,
  telefono: z
    .string()
    .trim()
    // Misma regla que la API (telefono en backend/src/shared/utils/schemas.js).
    .refine((v) => v === "" || /^\+?[\d\s-]{7,20}$/.test(v), "Teléfono inválido"),
  password: passwordNueva,
  acepta_politica_datos: z.boolean().refine((v) => v, "Debes aceptar la política de tratamiento de datos"),
});
export type RegistroValores = z.infer<typeof registroSchema>;

/** A4 sin cuenta: contraseña nueva y, si la API lo pide, la política. */
export const invitacionNuevaSchema = (requierePolitica: boolean) =>
  z.object({
    nombre,
    apellido: nombre,
    password: passwordNueva,
    acepta_politica_datos: z
      .boolean()
      .refine((v) => v || !requierePolitica, "Debes aceptar la política de tratamiento de datos"),
  });
export type InvitacionNuevaValores = z.infer<ReturnType<typeof invitacionNuevaSchema>>;

/** A4 con cuenta: solo la contraseña actual. */
export const invitacionExistenteSchema = z.object({
  password: z.string().min(1, "Escribe tu contraseña actual"),
});
export type InvitacionExistenteValores = z.infer<typeof invitacionExistenteSchema>;
