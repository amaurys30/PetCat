import { z } from "zod";
import {
  conAlMenosUnCampo,
  coordenadasJuntas,
  email,
  idParam,
  latitud,
  longitud,
  telefono,
  texto,
  urlHttp,
} from "../../shared/utils/schemas.js";

export const TIPOS_NEGOCIO = [
  "veterinaria",
  "tienda_mascotas",
  "peluqueria_canina",
  "guarderia",
  "entrenador",
  "clinica",
  "multiservicio",
];

export const idNegocioParams = idParam("id_negocio");

const url = urlHttp();

// Campos opcionales que se pueden vaciar enviando null.
const opcionales = {
  descripcion: texto(2000).nullable(),
  telefono: telefono.nullable(),
  whatsapp: telefono.nullable(),
  email: email.nullable(),
  sitio_web: urlHttp(300).nullable(),
  nit: texto(20).nullable(),
  razon_social: texto(200).nullable(),
  direccion: texto(300).nullable(),
  codigo_postal: texto(10).nullable(),
  latitud: latitud.nullable(),
  longitud: longitud.nullable(),
  logo_url: url.nullable(),
  banner_url: url.nullable(),
};

const campos = {
  nombre: z.string().trim().min(2).max(150),
  tipo: z.enum(TIPOS_NEGOCIO, { error: `Debe ser uno de: ${TIPOS_NEGOCIO.join(", ")}` }),
  ciudad: texto(100),
  departamento: texto(100),
  pais: texto(60),
  ...opcionales,
};

// ciudad, departamento y país toman los valores por defecto de la base (Sincelejo, Sucre, Colombia).
export const createNegocioBody = z
  .strictObject(campos)
  .partial()
  .required({ nombre: true, tipo: true })
  .superRefine(coordenadasJuntas);

export const updateNegocioBody = conAlMenosUnCampo(z.strictObject(campos).partial()).superRefine(
  coordenadasJuntas
);

/** Columnas que el negocio puede escribir: lista blanca de INSERT y UPDATE. */
export const CAMPOS_NEGOCIO = Object.keys(campos);
