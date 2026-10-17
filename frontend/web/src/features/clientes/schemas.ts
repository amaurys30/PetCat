import { z } from "zod";
import type { MascotaNueva, RegistrarClienteBody } from "@/api/clientes";
import { email, opcional, telefono } from "@/features/negocios/schemas";

// Mismas reglas que la API (cliente.schemas.js y mascota.schemas.js); vacío = sin dato.
const nombre = z.string().trim().min(2, "Debe tener al menos 2 caracteres").max(80, "Máximo 80 caracteres");
const fecha = z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha inválida");
const peso = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || (/^\d+([.,]\d{1,2})?$/.test(v) && Number(v.replace(",", ".")) > 0),
    "Peso inválido",
  );

/** Las especies que se eligen con un botón; las demás van como "otro". */
export const ESPECIES = [
  { valor: "perro", texto: "Perro" },
  { valor: "gato", texto: "Gato" },
  { valor: "conejo", texto: "Conejo" },
  { valor: "ave", texto: "Ave" },
  { valor: "otro", texto: "Otro" },
] as const;

export const mascotaSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre").max(80, "Máximo 80 caracteres"),
  especie: z.enum(["perro", "gato", "conejo", "ave", "otro"], { error: "Elige la especie" }),
  raza: opcional(80),
  fecha_nacimiento: fecha,
  peso,
});
export type MascotaValores = z.infer<typeof mascotaSchema>;

/**
 * C3 · Registrar cliente sin app. Sin correo queda sin cuenta y el teléfono es
 * obligatorio. La autorización de la Ley 1581 es obligatoria siempre.
 */
export const registroSchema = z
  .object({
    nombre,
    apellido: nombre,
    email,
    telefono,
    mascota: mascotaSchema,
    autoriza: z
      .boolean()
      .refine((v) => v, "Necesitamos la autorización del cliente para registrar sus datos"),
  })
  .superRefine((v, ctx) => {
    if (v.email.trim() === "" && v.telefono.trim() === "") {
      ctx.addIssue({
        code: "custom",
        path: ["telefono"],
        message: "Obligatorio si el cliente no tiene correo",
      });
    }
  });
export type RegistroValores = z.infer<typeof registroSchema>;

export const CAMPOS_REGISTRO = [
  "nombre",
  "apellido",
  "email",
  "telefono",
  "mascota.nombre",
  "mascota.especie",
  "mascota.raza",
  "mascota.fecha_nacimiento",
  "mascota.peso",
] as const;

export const mascotaAApi = (m: MascotaValores): MascotaNueva => ({
  nombre: m.nombre.trim(),
  especie: m.especie,
  ...(m.raza.trim() && { raza: m.raza.trim() }),
  ...(m.fecha_nacimiento && { fecha_nacimiento: m.fecha_nacimiento }),
  ...(m.peso.trim() && { peso: Number(m.peso.replace(",", ".")) }),
});

export const registroAApi = (v: RegistroValores): RegistrarClienteBody => ({
  nombre: v.nombre.trim(),
  apellido: v.apellido.trim(),
  ...(v.email.trim() && { email: v.email.trim().toLowerCase() }),
  ...(v.telefono.trim() && { telefono: v.telefono.trim() }),
  autoriza_tratamiento_datos: true,
  mascota: mascotaAApi(v.mascota),
});

export const mascotaVacia = (): MascotaValores => ({
  nombre: "",
  especie: "perro",
  raza: "",
  fecha_nacimiento: "",
  peso: "",
});
