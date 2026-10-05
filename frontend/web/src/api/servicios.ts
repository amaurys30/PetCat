import { apiDelete, apiGet, apiGetPagina, apiPatch, apiPost } from "./client";
import type { CitaAfectada } from "./negocios";
import type { components } from "./schema";
import type { Body } from "./types";

type Schemas = components["schemas"];

export type Servicio = Schemas["Servicio"];
export type CategoriaServicio = Schemas["CategoriaServicio"];
export type ServicioInput = Schemas["ServicioInput"];
export type CrearServicioBody = Body<"/negocios/{id_negocio}/servicios", "post">;
export type TipoPrecio = NonNullable<ServicioInput["tipo_precio"]>;
export type Especie = NonNullable<ServicioInput["tipo_mascota"]>[number];
export type Dia = NonNullable<ServicioInput["dias_disponible"]>[number];

export interface FiltrosServicios {
  page?: number;
  limit?: number;
  activo?: boolean;
}

/** Requiere servicios.ver. Paginado (máximo 100 por página). */
export const getServicios = (idNegocio: number, params: FiltrosServicios) =>
  apiGetPagina<Servicio>(`/negocios/${idNegocio}/servicios`, params);

/**
 * Todo el catálogo (activos e inactivos), de 100 en 100. El catálogo de un negocio es corto:
 * así los filtros, el encabezado y el aviso de servicios sin profesionales usan todos los servicios.
 */
export async function getCatalogo(idNegocio: number): Promise<Servicio[]> {
  const servicios: Servicio[] = [];
  for (let page = 1; ; page++) {
    const pagina = await getServicios(idNegocio, { page, limit: 100 });
    servicios.push(...pagina.data);
    if (!pagina.meta.hasNext) return servicios;
  }
}

/** Detalle del panel (servicios.ver), también de servicios inactivos u ocultos. */
export const getServicio = (idServicio: number) => apiGet<Servicio>(`/servicios/${idServicio}/gestion`);

/** Público: categorías activas en orden de presentación. */
export const getCategorias = () => apiGet<CategoriaServicio[]>("/categorias-servicio");

/** servicios.crear. 409 si el nombre ya lo usa otro servicio activo. */
export const crearServicio = (idNegocio: number, body: CrearServicioBody) =>
  apiPost<Servicio>(`/negocios/${idNegocio}/servicios`, body);

/** servicios.editar. `empleados` reemplaza los profesionales activos asignados. */
export const actualizarServicio = (idServicio: number, body: ServicioInput) =>
  apiPatch<Servicio>(`/servicios/${idServicio}`, body);

/**
 * servicios.eliminar (borrado lógico). 409 si tiene citas futuras pendientes o confirmadas:
 * el error trae la lista en `data.citas_afectadas` (ver `citasDelConflicto`).
 */
export const desactivarServicio = (idServicio: number) => apiDelete<null>(`/servicios/${idServicio}`);

/** servicios.editar. 409 si ya está activo o si su nombre lo usa otro servicio activo (`errors.nombre`). */
export const reactivarServicio = (idServicio: number) =>
  apiPatch<Servicio>(`/servicios/${idServicio}/reactivar`);

/** Citas que impiden desactivar un servicio (409 del DELETE). */
export const citasDelConflicto = (data: unknown): CitaAfectada[] => {
  const citas = (data as { citas_afectadas?: unknown } | null)?.citas_afectadas;
  return Array.isArray(citas) ? (citas as CitaAfectada[]) : [];
};
