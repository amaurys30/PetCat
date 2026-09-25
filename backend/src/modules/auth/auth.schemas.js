import { z } from "zod";

// Se normaliza antes de validar: los emails se guardan y se buscan en minúsculas.
const email = z.string().trim().toLowerCase().pipe(z.email().max(150));

const nombre = z.string().trim().min(2).max(80);

/** Contraseña de una cuenta nueva (registro y aceptar invitación). bcrypt solo usa los primeros 72 bytes. */
export const passwordNueva = z
  .string()
  .min(8)
  .max(72)
  .regex(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/, "Debe incluir al menos una letra")
  .regex(/\d/, "Debe incluir al menos un número");

export const registerBody = z.strictObject({
  nombre,
  apellido: nombre,
  email,
  password: passwordNueva,
  telefono: z
    .string()
    .trim()
    .regex(/^\+?[\d\s-]{7,20}$/, "Teléfono inválido")
    .optional(),
  // El admin de plataforma no se crea desde el registro público.
  tipo_usuario: z
    .enum(["cliente", "negocio"], { error: "Debe ser 'cliente' o 'negocio'" })
    .default("cliente"),
});

export const loginBody = z.strictObject({
  email,
  password: z.string().min(1).max(200),
  dispositivo: z.string().trim().max(200).optional(),
});
