import { z } from "zod";
import { paginationSchema } from "../../shared/utils/pagination.js";
import { conAlMenosUnCampo, fecha, fechaNoFutura, idParam, texto, urlHttps } from "../../shared/utils/schemas.js";

export const TIPOS_HISTORIAL = [
  "consulta_general",
  "cirugia",
  "vacunacion",
  "examen_laboratorio",
  "radiografia",
  "ecografia",
  "hospitalizacion",
  "urgencia",
  "desparasitacion",
  "otro",
];

const id = z.number().int().positive();

export const idHistorialParams = idParam("id_historial");
export const mascotaDeNegocioParams = idParam("id_negocio").extend({ id_mascota: z.coerce.number().int().positive() });

const clinico = (max = 2000) => texto(max).nullable();

// Campos que se pueden escribir (el negocio, la mascota y la cita no cambian al editar).
const campos = {
  tipo: z.enum(TIPOS_HISTORIAL, { error: `Debe ser uno de: ${TIPOS_HISTORIAL.join(", ")}` }),
  fecha: fechaNoFutura,
  motivo_consulta: clinico(),
  diagnostico: clinico(),
  tratamiento: clinico(),
  medicamentos_prescritos: clinico(),
  indicaciones: clinico(),
  proximo_control: fecha.nullable(),
  peso_registro: z.number().positive().max(9999.99).nullable(),
  temperatura: z.number().min(25).max(45).nullable(),
  frecuencia_cardiaca: z.number().int().min(1).max(500).nullable(),
  frecuencia_respiratoria: z.number().int().min(1).max(300).nullable(),
  // Solo https; la subida con Cloudinary (Fase 2) llenará este mismo campo.
  archivos: z.array(urlHttps()).max(10).nullable(),
  notas_internas: clinico(),
  id_empleado: id.nullable(),
};

export const createHistorialBody = z
  .strictObject({ ...campos, id_mascota: id, id_cita: id.optional() })
  .partial()
  .required({ id_mascota: true, tipo: true });

export const updateHistorialBody = conAlMenosUnCampo(z.strictObject(campos).partial());

export const listHistorialQuery = paginationSchema.extend({
  tipo: z.enum(TIPOS_HISTORIAL, { error: `Debe ser uno de: ${TIPOS_HISTORIAL.join(", ")}` }).optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
});

/** Columnas de historial_medico que se pueden escribir (`archivos` va en archivos_json). */
export const CAMPOS_HISTORIAL = Object.keys(campos).filter((c) => c !== "archivos");
