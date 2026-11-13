import { apiGet, apiGetPagina } from "./client";
import type { components } from "./schema";

type Schemas = components["schemas"];

export type EstadisticasPublicas = Schemas["EstadisticasPublicas"];
export type ResenaLanding = Schemas["ResenaLanding"];
export type ConfiguracionPublica = Schemas["ConfiguracionPublica"];
export type NegocioBusqueda = Schemas["NegocioBusqueda"];

export interface FiltrosBusqueda {
  lat: number;
  lng: number;
  tipo?: NegocioBusqueda["tipo"];
  q?: string;
  page?: number;
  limit?: number;
}

/** Todas públicas (sin sesión). Las de /publico vienen en caché del servidor (5 minutos). */
export const getEstadisticas = () =>
  apiGet<EstadisticasPublicas>("/publico/estadisticas", undefined, { sinRenovar: true });

export const getResenasDestacadas = (limit = 6) =>
  apiGet<ResenaLanding[]>("/publico/resenas", { limit }, { sinRenovar: true });

export const getConfiguracionPublica = () =>
  apiGet<ConfiguracionPublica>("/publico/configuracion", undefined, { sinRenovar: true });

/** Búsqueda de la app: negocios activos dentro del radio por defecto (10 km), los destacados primero. */
export const buscarNegocios = (filtros: FiltrosBusqueda) =>
  apiGetPagina<NegocioBusqueda>("/negocios", filtros);
