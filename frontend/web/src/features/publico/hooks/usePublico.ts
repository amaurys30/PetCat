import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getPoliticaVigente } from "@/api/auth";
import { getPlanes } from "@/api/negocios";
import {
  buscarNegocios,
  getConfiguracionPublica,
  getEstadisticas,
  getResenasDestacadas,
  type FiltrosBusqueda,
} from "@/api/publico";
import { queryKeys } from "@/lib/queryKeys";

// Datos que casi no cambian: la API los guarda 5 minutos; aquí no se vuelven a pedir en la visita.
const DURADERO = { staleTime: 5 * 60_000, retry: 1 } as const;

export const useEstadisticas = () =>
  useQuery({ queryKey: queryKeys.publico.estadisticas(), queryFn: getEstadisticas, ...DURADERO });

export const useResenasDestacadas = () =>
  useQuery({ queryKey: queryKeys.publico.resenas(), queryFn: () => getResenasDestacadas(6), ...DURADERO });

export const useConfiguracionPublica = () =>
  useQuery({ queryKey: queryKeys.publico.configuracion(), queryFn: getConfiguracionPublica, ...DURADERO });

export const usePolitica = () =>
  useQuery({ queryKey: queryKeys.politica(), queryFn: getPoliticaVigente, ...DURADERO });

export const usePlanes = () => useQuery({ queryKey: queryKeys.planes(), queryFn: getPlanes, ...DURADERO });

export const POR_PAGINA = 6;

/** Negocios cercanos, de 6 en 6 ("Ver más"). Mientras cambia el filtro se ven los anteriores. */
export const useNegociosCercanos = (filtros: Omit<FiltrosBusqueda, "page" | "limit">) =>
  useInfiniteQuery({
    queryKey: queryKeys.publico.negocios(filtros),
    queryFn: ({ pageParam }) => buscarNegocios({ ...filtros, page: pageParam, limit: POR_PAGINA }),
    initialPageParam: 1,
    getNextPageParam: (ultima) => (ultima.meta.hasNext ? ultima.meta.page + 1 : undefined),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
