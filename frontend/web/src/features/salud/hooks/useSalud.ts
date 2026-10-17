import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import * as api from "@/api/salud";
import { vigenciaRestante } from "@/lib/archivos";
import { queryKeys } from "@/lib/queryKeys";

const POR_PAGINA = 10;

const siguiente = ({ meta }: { meta: { page: number; hasNext: boolean } }) =>
  meta.hasNext ? meta.page + 1 : undefined;

/** Cabecera y resumen de la ficha. El 403 (sin cita válida) lo muestra la página. */
export function useResumenSalud(idNegocio: number, idMascota: number) {
  return useQuery({
    queryKey: queryKeys.salud.resumen(idNegocio, idMascota),
    queryFn: () => api.getResumenSalud(idNegocio, idMascota),
  });
}

/**
 * Historial de la mascota, de 10 en 10. Queda viejo cuando está por vencer la primera URL
 * firmada de sus archivos, así al volver a la pestaña se pide de nuevo.
 */
export function useHistorial(
  idNegocio: number,
  idMascota: number,
  filtros: api.FiltrosHistorial,
  habilitada: boolean,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.salud.historial(idNegocio, idMascota, filtros),
    queryFn: ({ pageParam }) =>
      api.getHistorial(idNegocio, idMascota, { ...filtros, page: pageParam, limit: POR_PAGINA }),
    initialPageParam: 1,
    getNextPageParam: siguiente,
    enabled: habilitada,
    staleTime: (q) =>
      vigenciaRestante(q.state.data?.pages.flatMap((p) => p.data.flatMap((r) => r.archivos)) ?? []),
  });
}

/** Carnet completo (todas las dosis). Queda viejo cuando está por vencer un comprobante. */
export function useVacunas(idNegocio: number, idMascota: number, habilitada: boolean) {
  return useQuery({
    queryKey: queryKeys.salud.vacunas(idNegocio, idMascota),
    queryFn: () => api.getVacunas(idNegocio, idMascota),
    enabled: habilitada,
    staleTime: (q) =>
      vigenciaRestante((q.state.data ?? []).flatMap((v) => (v.comprobante ? [v.comprobante] : []))),
  });
}

/** Citas de la mascota con el negocio (citas.ver o clientes.ver). */
export function useCitasMascota(idNegocio: number, idMascota: number, habilitada: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.citas.mascota(idNegocio, idMascota),
    queryFn: ({ pageParam }) => api.getCitasMascota(idNegocio, idMascota, { page: pageParam, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: siguiente,
    enabled: habilitada,
  });
}
