import { z } from "zod";
import { camposCoordenadas, coordenadasJuntas } from "@/lib/ubicacion";
import { TIPOS_NEGOCIO, type TipoNegocio } from "./textos";

// Mismas reglas que la API (backend/src/shared/utils/schemas.js); vacío = sin dato.
const telefono = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\+?[\d\s-]{7,20}$/.test(v), "Teléfono inválido");
const opcional = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`);
const email = z
  .string()
  .trim()
  .refine((v) => v === "" || z.email().safeParse(v).success, "Correo electrónico inválido");

const tipo = z.enum(Object.keys(TIPOS_NEGOCIO) as [TipoNegocio, ...TipoNegocio[]], {
  error: "Elige el tipo de negocio",
});

/** A6 paso 1. */
export const datosNegocioSchema = z.object({
  nombre: z.string().trim().min(2, "Debe tener al menos 2 caracteres").max(150, "Máximo 150 caracteres"),
  tipo,
  telefono,
  email,
  nit: opcional(20),
  ciudad: z.string().trim().min(1, "Escribe la ciudad").max(100, "Máximo 100 caracteres"),
});
export type DatosNegocioValores = z.infer<typeof datosNegocioSchema>;

/** Sede: A6 paso 2 y E2. */
export const sedeSchema = z
  .object({
    nombre: z.string().trim().min(2, "Debe tener al menos 2 caracteres").max(150, "Máximo 150 caracteres"),
    direccion: z.string().trim().min(1, "Escribe la dirección").max(300, "Máximo 300 caracteres"),
    telefono,
    ...camposCoordenadas,
  })
  .superRefine(coordenadasJuntas);
export type SedeValores = z.infer<typeof sedeSchema>;

export const CAMPOS_SEDE = ["nombre", "direccion", "telefono", "latitud", "longitud"] as const;

export const CAMPOS_DATOS_NEGOCIO = ["nombre", "tipo", "telefono", "email", "nit", "ciudad"] as const;

/** Pasos del asistente A6, en orden. */
export const PASOS = ["negocio", "sede", "horarios"] as const;
export type Paso = (typeof PASOS)[number];
