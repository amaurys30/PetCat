import { apiDelete, apiGet, apiGetPagina, apiPatch, apiPost, apiPut } from "./client";
import type { CitaPanel } from "./citas";
import type { components } from "./schema";
import type { Body } from "./types";

type Schemas = components["schemas"];

export type ResumenSalud = Schemas["ResumenSalud"];
export type RegistroHistorial = Schemas["RegistroHistorial"];
export type Vacuna = Schemas["Vacuna"];
export type ArchivoPrivado = Schemas["ArchivoPrivado"];

export const TIPOS_HISTORIAL = [
  "consulta_general",
  "control",
  "cirugia",
  "vacunacion",
  "examen_laboratorio",
  "radiografia",
  "ecografia",
  "hospitalizacion",
  "urgencia",
  "desparasitacion",
  "otro",
] as const;
export type TipoHistorial = (typeof TIPOS_HISTORIAL)[number];

export interface FiltrosHistorial {
  tipo?: TipoHistorial;
  desde?: string;
}

/**
 * historial_medico.ver o vacunas.ver, y una cita válida con la mascota (403 si no). Cabecera
 * de la ficha (mascota completa y dueño), alertas de vacunas, controles, próxima cita y peso.
 */
export const getResumenSalud = (idNegocio: number, idMascota: number) =>
  apiGet<ResumenSalud>(`/negocios/${idNegocio}/mascotas/${idMascota}/resumen-salud`);

/**
 * historial_medico.ver. Sin `compartir_historial`, solo los registros de este negocio; las
 * notas internas solo en los propios. Los archivos traen URL firmada que vence.
 */
export const getHistorial = (
  idNegocio: number,
  idMascota: number,
  params: FiltrosHistorial & { page: number; limit: number },
) => apiGetPagina<RegistroHistorial>(`/negocios/${idNegocio}/mascotas/${idMascota}/historial`, params);

/** vacunas.ver. Todas las vacunas (también las del dueño y con compartir desactivado). */
export const getVacunas = (idNegocio: number, idMascota: number) =>
  apiGet<Vacuna[]>(`/negocios/${idNegocio}/mascotas/${idMascota}/vacunas`);

/** citas.ver o clientes.ver. Citas de la mascota con este negocio, de la más reciente hacia atrás. */
export const getCitasMascota = (
  idNegocio: number,
  idMascota: number,
  params: { page: number; limit: number; estado?: string },
) => apiGetPagina<CitaDeMascota>(`/negocios/${idNegocio}/mascotas/${idMascota}/citas`, params);

export type RegistroDeCita = Schemas["RegistroDeCita"];
/** Cita de la mascota con sus registros médicos (para "Vincular a una cita" de C4). */
export type CitaDeMascota = CitaPanel & { registros_medicos: RegistroDeCita[] };

export type NuevoRegistro = Body<"/negocios/{id_negocio}/historial", "post">;
export type CambiosRegistro = Body<"/historial/{id_historial}", "patch">;

/** Formatos y tamaño que acepta la API para los archivos del historial y los comprobantes. */
export const TIPOS_ARCHIVO = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const MAX_BYTES_ARCHIVO = 10 * 1024 * 1024;
export const MAX_ARCHIVOS_REGISTRO = 10;
export const ARCHIVOS_POR_ENVIO = 5;

/** historial_medico.crear y una cita válida con la mascota. */
export const crearRegistro = (idNegocio: number, body: NuevoRegistro) =>
  apiPost<RegistroHistorial>(`/negocios/${idNegocio}/historial`, body);

/** historial_medico.editar, solo el negocio que lo creó. Deja constancia de la edición. */
export const editarRegistro = (idHistorial: number, body: CambiosRegistro) =>
  apiPatch<RegistroHistorial>(`/historial/${idHistorial}`, body);

/** multipart con hasta 5 archivos en `archivos`; 10 por registro. Responde el registro. */
export const subirArchivosRegistro = (idHistorial: number, archivos: File[]) => {
  const datos = new FormData();
  for (const archivo of archivos) datos.append("archivos", archivo);
  return apiPost<RegistroHistorial>(`/historial/${idHistorial}/archivos`, datos);
};

export const eliminarArchivoRegistro = (idHistorial: number, idArchivo: number) =>
  apiDelete<RegistroHistorial>(`/historial/${idHistorial}/archivos/${idArchivo}`);

export type NuevaVacuna = Body<"/negocios/{id_negocio}/vacunas", "post">;
export type CambiosVacuna = Body<"/vacunas/{id_vacuna}", "patch">;

/** vacunas.crear y una cita válida con la mascota. 409 si la mascota está fallecida. */
export const crearVacuna = (idNegocio: number, body: NuevaVacuna) =>
  apiPost<Vacuna>(`/negocios/${idNegocio}/vacunas`, body);

/**
 * vacunas.editar, solo las que registró este negocio. Deja constancia de la edición; con otra
 * fecha_proxima, los recordatorios del dueño vuelven a empezar.
 */
export const editarVacuna = (idVacuna: number, body: CambiosVacuna) =>
  apiPatch<Vacuna>(`/vacunas/${idVacuna}`, body);

/** multipart con el archivo en `comprobante` (foto o PDF); reemplaza el anterior. */
export const subirComprobante = (idVacuna: number, archivo: File) => {
  const datos = new FormData();
  datos.append("comprobante", archivo);
  return apiPut<Vacuna>(`/vacunas/${idVacuna}/comprobante`, datos);
};

export const eliminarComprobante = (idVacuna: number) =>
  apiDelete<Vacuna>(`/vacunas/${idVacuna}/comprobante`);
