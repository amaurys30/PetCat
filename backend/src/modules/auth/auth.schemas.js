import { z } from "zod";
// El email se normaliza antes de validar: se guarda y se busca en minúsculas.
import { autorizacionDatos, conAlMenosUnCampo, email, telefono } from "../../shared/utils/schemas.js";

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
  telefono: telefono.optional(),
  // El admin de plataforma no se crea desde el registro público.
  tipo_usuario: z
    .enum(["cliente", "negocio"], { error: "Debe ser 'cliente' o 'negocio'" })
    .default("cliente"),
  acepta_politica_datos: autorizacionDatos("Debes aceptar la política de tratamiento de datos (Ley 1581 de 2012)"),
});

export const loginBody = z.strictObject({
  email,
  password: z.string().min(1).max(200),
  dispositivo: z.string().trim().max(200).optional(),
});

export const refreshTokenBody = z.strictObject({
  refresh_token: z.string().min(1).max(2000),
});

const zonaHorariaValida = (zona) => {
  try {
    new Intl.DateTimeFormat("es", { timeZone: zona });
    return true;
  } catch {
    return false;
  }
};

// El email y la foto no se cambian aquí (ver Decisiones de la Fase 1 en docs/PLAN.md).
export const updateMeBody = conAlMenosUnCampo(
  z
    .strictObject({
      nombre,
      apellido: nombre,
      telefono: telefono.nullable(),
      idioma: z.enum(["es", "en"], { error: "Debe ser 'es' o 'en'" }),
      zona_horaria: z.string().trim().max(50).refine(zonaHorariaValida, "Zona horaria inválida (ej.: America/Bogota)"),
      notif_email: z.boolean(),
      notif_push: z.boolean(),
      notif_whatsapp: z.boolean(),
    })
    .partial()
);

export const changePasswordBody = z.strictObject({
  password_actual: z.string().min(1).max(200),
  password_nueva: passwordNueva,
});

export const forgotPasswordBody = z.strictObject({ email });

// Tokens de los enlaces de correo: 64 caracteres hexadecimales.
const tokenCorreo = z.string().regex(/^[0-9a-f]{64}$/, "Token inválido");

export const resetPasswordBody = z.strictObject({
  token: tokenCorreo,
  password: passwordNueva,
});

export const verifyEmailParams = z.object({ token: tokenCorreo });
