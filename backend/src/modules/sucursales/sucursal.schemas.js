import { z } from "zod";
import {
  conAlMenosUnCampo,
  coordenadasJuntas,
  idParam,
  latitud,
  longitud,
  telefono,
} from "../../shared/utils/schemas.js";

export const idSucursalParams = idParam("id_sucursal");

const texto = (max) => z.string().trim().min(1).max(max);

const campos = {
  nombre: z.string().trim().min(2).max(150),
  direccion: texto(300),
  ciudad: texto(100),
  descripcion: texto(300).nullable(),
  telefono: telefono.nullable(),
  latitud: latitud.nullable(),
  longitud: longitud.nullable(),
  es_principal: z.boolean(),
};

// ciudad toma el valor por defecto de la base (Sincelejo).
export const createSucursalBody = z
  .strictObject(campos)
  .partial()
  .required({ nombre: true, direccion: true })
  .superRefine(coordenadasJuntas);

export const updateSucursalBody = conAlMenosUnCampo(z.strictObject(campos).partial()).superRefine(
  coordenadasJuntas
);

/** Columnas que se pueden escribir: lista blanca de INSERT y UPDATE. */
export const CAMPOS_SUCURSAL = Object.keys(campos);
