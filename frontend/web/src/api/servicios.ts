import { apiGetPagina } from "./client";
import type { components } from "./schema";

export type Servicio = components["schemas"]["Servicio"];

/** Requiere servicios.ver. Paginado (máximo 100 por página). */
export const getServicios = (
  idNegocio: number,
  params: { page?: number; limit?: number; activo?: boolean },
) => apiGetPagina<Servicio>(`/negocios/${idNegocio}/servicios`, params);
