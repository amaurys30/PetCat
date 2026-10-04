import { z } from "zod";
import { paginationSchema } from "../../shared/utils/pagination.js";
import {
  conAlMenosUnCampo,
  email,
  idParam,
  telefono,
  texto,
} from "../../shared/utils/schemas.js";

export const idEmpleadoParams = idParam("id_empleado");

const nombre = z.string().trim().min(2).max(80);

// id_usuario, id_negocio, activo y fecha_retiro no se aceptan: los maneja la API
// (invitaciones, la ruta y desactivar/reactivar). La foto se sube con PUT /empleados/:id_empleado/foto.
const campos = {
  id_rol: z.int().positive(),
  nombre,
  apellido: nombre,
  email: email.nullable(),
  telefono: telefono.nullable(),
  documento: texto(30).nullable(),
  especialidad: texto(150).nullable(),
  titulo_profesional: texto(150).nullable(),
  registro_profesional: texto(60).nullable(),
  notas: texto(2000).nullable(),
  fecha_vinculacion: z.iso.date({ error: "Fecha inválida: usa YYYY-MM-DD" }),
};

// Servicios que atiende: reemplaza el conjunto de servicios activos asignados (no es columna).
const servicios = z
  .array(z.number().int().positive())
  .max(200)
  .transform((lista) => [...new Set(lista)]);

export const createEmpleadoBody = z
  .strictObject({ ...campos, servicios })
  .partial()
  .required({ id_rol: true, nombre: true, apellido: true });

export const updateEmpleadoBody = conAlMenosUnCampo(z.strictObject({ ...campos, servicios }).partial());

// El propietario como empleado: nombre, apellido y email salen de su cuenta.
export const empleadoPropioBody = z
  .strictObject(campos)
  .omit({ nombre: true, apellido: true, email: true })
  .partial();

export const listEmpleadosQuery = paginationSchema.extend({
  activo: z
    .enum(["true", "false"], { error: "Debe ser true o false" })
    .transform((valor) => valor === "true")
    .optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

/** Columnas que se pueden escribir: lista blanca de INSERT y UPDATE. */
export const CAMPOS_EMPLEADO = Object.keys(campos);
