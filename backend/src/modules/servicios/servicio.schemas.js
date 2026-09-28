import { z } from "zod";
import { paginationSchema } from "../../shared/utils/pagination.js";
import { conAlMenosUnCampo, fecha, idParam, texto } from "../../shared/utils/schemas.js";

export const TIPOS_PRECIO = ["fijo", "por_hora", "por_dia", "variable"];
// Valores de la columna SET servicios.tipo_mascota (no incluye pez ni otro).
export const ESPECIES_SERVICIO = ["perro", "gato", "conejo", "ave", "reptil", "roedor", "todos"];
// Valores de la columna SET servicios.dias_disponible, en orden de la semana.
export const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

export const idServicioParams = idParam("id_servicio");

const dinero = z.number().min(0).max(9999999999.99);
const peso = z.number().positive().max(9999.99);
const minutos = (min, max) => z.number().int().min(min).max(max).multipleOf(5, "Debe ser múltiplo de 5");

/** Lista sin repetidos, en el orden en que llegó. */
const sinRepetidos = (lista) => [...new Set(lista)];

const tipoMascota = z
  .array(z.enum(ESPECIES_SERVICIO, { error: `Debe ser una de: ${ESPECIES_SERVICIO.join(", ")}` }))
  .min(1)
  .transform(sinRepetidos)
  .refine((lista) => !lista.includes("todos") || lista.length === 1, "'todos' no se combina con otras especies");

const campos = {
  id_categoria: z.number().int().positive(),
  nombre: z.string().trim().min(2).max(150),
  descripcion: texto(2000).nullable(),
  precio_base: dinero,
  precio_maximo: dinero.nullable(),
  tipo_precio: z.enum(TIPOS_PRECIO, { error: `Debe ser uno de: ${TIPOS_PRECIO.join(", ")}` }),
  duracion_minutos: minutos(5, 1440),
  margen_minutos: minutos(0, 240),
  tipo_mascota: tipoMascota,
  peso_min_kg: peso.nullable(),
  peso_max_kg: peso.nullable(),
  requiere_cita: z.boolean(),
  max_citas_dia: z.number().int().min(1).max(255).nullable(),
  dias_disponible: z
    .array(z.enum(DIAS, { error: `Debe ser uno de: ${DIAS.join(", ")}` }))
    .min(1)
    .transform(sinRepetidos)
    .nullable(),
  visible_app: z.boolean(),
  en_oferta: z.boolean(),
  precio_oferta: dinero.nullable(),
  fecha_inicio_oferta: fecha.nullable(),
  fecha_fin_oferta: fecha.nullable(),
  etiquetas: z.array(texto(40)).max(10).transform(sinRepetidos).nullable(),
  // Empleados que atienden el servicio: reemplaza el conjunto de empleados activos asignados.
  empleados: z.array(z.number().int().positive()).max(100).transform(sinRepetidos),
};

export const createServicioBody = z
  .strictObject(campos)
  .partial()
  .required({ id_categoria: true, nombre: true, precio_base: true });

export const updateServicioBody = conAlMenosUnCampo(z.strictObject(campos).partial());

const booleano = z
  .enum(["true", "false"], { error: "Debe ser true o false" })
  .transform((valor) => valor === "true");

export const listServiciosQuery = paginationSchema.extend({
  activo: booleano.optional(),
  visible_app: booleano.optional(),
  id_categoria: z.coerce.number().int().positive().optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

/**
 * Columnas de `servicios` que se pueden escribir: lista blanca de INSERT y UPDATE.
 * `etiquetas` y `empleados` no son columnas: el repositorio y el servicio los tratan aparte.
 */
export const CAMPOS_SERVICIO = Object.keys(campos).filter((c) => c !== "etiquetas" && c !== "empleados");
