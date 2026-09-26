import { z } from "zod";
import { conAlMenosUnCampo, fechaNoFutura, idParam, texto } from "../../shared/utils/schemas.js";

export const ESPECIES = ["perro", "gato", "conejo", "ave", "reptil", "roedor", "pez", "otro"];
export const SEXOS = ["macho", "hembra", "desconocido"];

export const idMascotaParams = idParam("id_mascota");

// Campos opcionales que se pueden vaciar enviando null.
const opcionales = {
  raza: texto(100).nullable(),
  color: texto(100).nullable(),
  fecha_nacimiento: fechaNoFutura.nullable(),
  peso: z.number().positive().max(9999.99).nullable(),
  microchip: texto(50).nullable(),
  numero_registro: texto(60).nullable(),
  alergias_detalle: texto(2000).nullable(),
  condiciones_medicas: texto(2000).nullable(),
  tipo_sangre: texto(10).nullable(),
};

// La foto se sube con Cloudinary en la Fase 2.
const campos = {
  nombre: texto(80),
  especie: z.enum(ESPECIES, { error: `Debe ser una de: ${ESPECIES.join(", ")}` }),
  sexo: z.enum(SEXOS, { error: `Debe ser uno de: ${SEXOS.join(", ")}` }),
  esterilizado: z.boolean(),
  tiene_alergias: z.boolean(),
  ...opcionales,
};

export const createMascotaBody = z.strictObject(campos).partial().required({ nombre: true, especie: true });

/**
 * Editar también permite registrar el fallecimiento: `fallecido: true` con
 * `fecha_fallecimiento` (por defecto hoy); `fallecido: false` la borra.
 */
export const updateMascotaBody = conAlMenosUnCampo(
  z
    .strictObject({
      ...campos,
      fallecido: z.boolean(),
      fecha_fallecimiento: fechaNoFutura.nullable(),
    })
    .partial()
);

/** Columnas que se pueden escribir: lista blanca de INSERT y UPDATE. */
export const CAMPOS_MASCOTA = [...Object.keys(campos), "fallecido", "fecha_fallecimiento"];
