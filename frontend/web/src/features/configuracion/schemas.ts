import { z } from "zod";
import { email, opcional, telefono, tipo } from "@/features/negocios/schemas";

/** "patitas.co" -> "https://patitas.co": la API exige una URL con http o https. */
export const conEsquema = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

const esUrl = (v: string) =>
  z.url({ protocol: /^https?$/ }).safeParse(conEsquema(v)).success && v.includes(".");

/** E1 · Datos del negocio. Vacío = sin dato (se envía null). */
export const perfilNegocioSchema = z.object({
  nombre: z.string().trim().min(2, "Debe tener al menos 2 caracteres").max(150, "Máximo 150 caracteres"),
  tipo,
  descripcion: opcional(2000),
  telefono,
  whatsapp: telefono,
  email,
  nit: opcional(20),
  razon_social: opcional(200),
  sitio_web: opcional(300).refine(
    (v) => v === "" || esUrl(v),
    "Escribe una dirección web (por ejemplo, patitas.co)",
  ),
});
export type PerfilNegocioValores = z.infer<typeof perfilNegocioSchema>;

export const CAMPOS_PERFIL_NEGOCIO = [
  "nombre",
  "tipo",
  "descripcion",
  "telefono",
  "whatsapp",
  "email",
  "nit",
  "razon_social",
  "sitio_web",
] as const;
