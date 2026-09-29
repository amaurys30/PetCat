import { z } from "zod";
import { conAlMenosUnCampo, fecha, fechaNoFutura, idParam, texto } from "../../shared/utils/schemas.js";

const id = z.number().int().positive();

export const idVacunaParams = idParam("id_vacuna");

// Campos que registran tanto el dueño como el negocio. El comprobante se sube con
// PUT /vacunas/:id_vacuna/comprobante (no se acepta una URL en el body).
const campos = {
  nombre_vacuna: texto(150),
  enfermedad_objetivo: texto(150).nullable(),
  laboratorio: texto(100).nullable(),
  lote: texto(60).nullable(),
  dosis: texto(60).nullable(),
  via_administracion: texto(60).nullable(),
  sitio_aplicacion: texto(60).nullable(),
  fecha_aplicacion: fechaNoFutura,
  fecha_proxima: fecha.nullable(),
  notas: texto(300).nullable(),
};

// Solo el negocio: quién la aplicó y el registro del historial al que pertenece.
const camposNegocio = { id_empleado: id.nullable(), id_historial_medico: id.nullable() };

export const createVacunaDuenoBody = z
  .strictObject(campos)
  .partial()
  .required({ nombre_vacuna: true, fecha_aplicacion: true });

export const createVacunaNegocioBody = z
  .strictObject({ ...campos, ...camposNegocio, id_mascota: id })
  .partial()
  .required({ id_mascota: true, nombre_vacuna: true, fecha_aplicacion: true });

/** PATCH: el servicio rechaza los campos del negocio si edita el dueño. */
export const updateVacunaBody = conAlMenosUnCampo(z.strictObject({ ...campos, ...camposNegocio }).partial());

/** Columnas que se pueden escribir. */
export const CAMPOS_VACUNA = [...Object.keys(campos), ...Object.keys(camposNegocio)];
export const CAMPOS_SOLO_NEGOCIO = Object.keys(camposNegocio);
