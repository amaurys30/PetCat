import { z } from "zod";
import { email, opcional, telefono } from "@/features/negocios/schemas";

// Mismas reglas que la API (empleado.schemas.js); vacío = sin dato.
const nombre = z.string().trim().min(2, "Debe tener al menos 2 caracteres").max(80, "Máximo 80 caracteres");
const fecha = z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha inválida");

/** D3b · Agregar / editar miembro. */
export const miembroSchema = z.object({
  nombre,
  apellido: nombre,
  email,
  telefono,
  documento: opcional(30),
  especialidad: opcional(150),
  titulo_profesional: opcional(150),
  registro_profesional: opcional(60),
  notas: opcional(2000),
  fecha_vinculacion: fecha,
  id_rol: z.number({ error: "Elige un rol" }).int().positive("Elige un rol"),
  servicios: z.array(z.number().int()),
});
export type MiembroValores = z.infer<typeof miembroSchema>;

export const CAMPOS_MIEMBRO = [
  "nombre",
  "apellido",
  "email",
  "telefono",
  "documento",
  "especialidad",
  "titulo_profesional",
  "registro_profesional",
  "notas",
  "fecha_vinculacion",
  "id_rol",
  "servicios",
] as const;

/** Agregarme como profesional (POST .../empleados/yo): nombre, apellido y correo salen de la cuenta. */
export const agregarmeSchema = z.object({
  id_rol: z.number().int().positive(),
  telefono,
  especialidad: opcional(150),
  titulo_profesional: opcional(150),
  registro_profesional: opcional(60),
});
export type AgregarmeValores = z.infer<typeof agregarmeSchema>;

/** D4 · rol propio. */
export const rolSchema = z.object({
  nombre: z.string().trim().min(2, "Debe tener al menos 2 caracteres").max(60, "Máximo 60 caracteres"),
  descripcion: opcional(200),
});
export type RolValores = z.infer<typeof rolSchema>;
