import { apiGet, apiGetPagina } from "./client";
import type { CitaPanel } from "./citas";
import type { components } from "./schema";

type Schemas = components["schemas"];

export type ResumenSalud = Schemas["ResumenSalud"];
export type RegistroHistorial = Schemas["RegistroHistorial"];
export type Vacuna = Schemas["Vacuna"];
export type ArchivoPrivado = Schemas["ArchivoPrivado"];

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
  params: { page: number; limit: number },
) => apiGetPagina<CitaPanel>(`/negocios/${idNegocio}/mascotas/${idMascota}/citas`, params);
