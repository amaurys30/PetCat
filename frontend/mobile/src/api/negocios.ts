import { api } from "./client";
import type { Meta, NegocioBusqueda, NegocioPublico, ResenaPublica, Respuesta } from "./types";

// Negocios públicos (Explorar y perfil). No requieren sesión.

export type FiltrosBusqueda = {
  q?: string;
  /** Tipos de negocio (se envían separados por comas). */
  tipos?: string[];
  abiertoAhora?: boolean;
  lat: number;
  lng: number;
};

/** Hasta 100 negocios del radio de búsqueda (el de la API: 10 km), del más cercano al más lejano. */
export async function getNegocios({
  q,
  tipos,
  abiertoAhora,
  lat,
  lng,
}: FiltrosBusqueda): Promise<{ negocios: NegocioBusqueda[]; total: number }> {
  const { data } = await api.get<Respuesta<NegocioBusqueda[]>>("/negocios", {
    params: {
      lat,
      lng,
      limit: 100,
      ...(q && { q }),
      ...(tipos?.length && { tipo: tipos.join(",") }),
      ...(abiertoAhora && { abierto_ahora: "true" }),
    },
  });
  return { negocios: data.data, total: data.meta?.total ?? data.data.length };
}

export async function getNegocio(id_negocio: number): Promise<NegocioPublico> {
  const { data } = await api.get<Respuesta<NegocioPublico>>(`/negocios/${id_negocio}`);
  return data.data;
}

export async function getResenas(
  id_negocio: number,
  page = 1,
): Promise<{ resenas: ResenaPublica[]; meta: Meta }> {
  const { data } = await api.get<Respuesta<ResenaPublica[]>>(`/negocios/${id_negocio}/resenas`, {
    params: { page, limit: 10, orden: "recientes" },
  });
  return { resenas: data.data, meta: data.meta! };
}
