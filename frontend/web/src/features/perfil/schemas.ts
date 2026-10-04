import { z } from "zod";
import { nombre, passwordNueva } from "@/features/auth/schemas";
import { telefono } from "@/features/negocios/schemas";

/** E6 · Datos personales. El teléfono vacío se borra (null). */
export const datosPersonalesSchema = z.object({
  nombre,
  apellido: nombre,
  telefono,
  idioma: z.enum(["es", "en"]),
});
export type DatosPersonalesValores = z.infer<typeof datosPersonalesSchema>;

/** E6 · Cambio de contraseña: coincidir y ser distinta de la actual, además de las reglas de la API. */
export const cambiarPasswordSchema = z
  .object({
    password_actual: z.string().min(1, "Escribe tu contraseña actual"),
    password_nueva: passwordNueva,
    confirmacion: z.string().min(1, "Repite la contraseña nueva"),
  })
  .refine((v) => v.password_nueva === v.confirmacion, {
    path: ["confirmacion"],
    message: "Las contraseñas no coinciden",
  })
  .refine((v) => v.password_nueva !== v.password_actual, {
    path: ["password_nueva"],
    message: "Debe ser distinta de la actual",
  });
export type CambiarPasswordValores = z.infer<typeof cambiarPasswordSchema>;
