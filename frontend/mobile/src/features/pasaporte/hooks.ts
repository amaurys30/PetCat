import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { getHistorial, getUltimaDesparasitacion, getVacunas } from "@/api/pasaporte";
import { queryKeys } from "@/lib/queryKeys";

import { TIPOS_POR_FILTRO, type FiltroLinea } from "./logica";

export const POR_PAGINA = 20;

/** Carnet de vacunas (se guarda en el teléfono: el Pasaporte funciona sin red). */
export function useVacunas(id_mascota: number | undefined) {
  return useQuery({
    queryKey: queryKeys.mascotas.vacunas(id_mascota ?? 0),
    queryFn: () => getVacunas(id_mascota!),
    enabled: !!id_mascota,
  });
}

/** Última desparasitación, para su sello (también se guarda en el teléfono). */
export function useUltimaDesparasitacion(id_mascota: number | undefined) {
  return useQuery({
    queryKey: queryKeys.mascotas.desparasitacion(id_mascota ?? 0),
    queryFn: () => getUltimaDesparasitacion(id_mascota!),
    enabled: !!id_mascota,
  });
}

/** Páginas del historial del filtro (no se guardan en el teléfono). "Vacunas" no lo pide. */
export function useHistorial(id_mascota: number, filtro: FiltroLinea) {
  const tipos = TIPOS_POR_FILTRO[filtro];
  return useInfiniteQuery({
    queryKey: queryKeys.historial(id_mascota, filtro),
    queryFn: ({ pageParam }) =>
      getHistorial(id_mascota, { tipos: tipos ?? [], page: pageParam, limit: POR_PAGINA }),
    initialPageParam: 1,
    getNextPageParam: (ultima) => (ultima.meta.hasNext ? ultima.meta.page + 1 : undefined),
    enabled: tipos !== null,
  });
}
