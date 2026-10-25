import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as api from "@/api/resenas";
import { aviso } from "@/components/ui/toaster";
import { queryKeys } from "@/lib/queryKeys";

const POR_PAGINA = 10;

/** Reseñas del panel (resenas.ver), de 10 en 10, con los filtros de la URL. */
export function useListaResenas(idNegocio: number, filtros: api.FiltrosResenas, habilitada = true) {
  return useInfiniteQuery({
    enabled: habilitada,
    queryKey: queryKeys.resenas.lista(idNegocio, filtros),
    queryFn: ({ pageParam }) =>
      api.getResenasGestion(idNegocio, { ...filtros, page: pageParam, limit: POR_PAGINA }),
    initialPageParam: 1,
    getNextPageParam: ({ meta }) => (meta.hasNext ? meta.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}

/**
 * Solo el resumen (el número del menú): una página de una reseña. Está en todas las pantallas,
 * así que no se vuelve a pedir al enfocar la ventana ni en 5 minutos; responder o reportar lo
 * invalidan, y una reseña nueva llega como notificación (P6.4).
 */
export function useResumenResenas(idNegocio: number, habilitada: boolean) {
  return useQuery({
    queryKey: queryKeys.resenas.resumen(idNegocio),
    queryFn: async () => (await api.getResenasGestion(idNegocio, { page: 1, limit: 1 })).meta.resumen,
    enabled: habilitada,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Responder, borrar la respuesta o reportar cambian la lista, el resumen y el dashboard. */
function useRecargar(idNegocio: number) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.resenas.todas(idNegocio) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.todo(idNegocio) }),
    ]);
}

/**
 * El formulario muestra sus errores (422 en el campo); los demás, el manejo global. El aviso
 * va aquí y no en la llamada a `mutate`: al recargar, la tarjeta ya tiene la respuesta y
 * desmonta el formulario, y TanStack descarta los callbacks de esa llamada.
 */
export function useResponder(idNegocio: number) {
  const recargar = useRecargar(idNegocio);
  return useMutation({
    mutationFn: ({ idResena, respuesta }: { idResena: number; respuesta: string; editando: boolean }) =>
      api.responderResena(idResena, respuesta),
    onSuccess: async (_resena, { editando }) => {
      aviso.exito(editando ? "Respuesta actualizada" : "Respuesta publicada");
      await recargar();
    },
  });
}

export function useBorrarRespuesta(idNegocio: number) {
  const recargar = useRecargar(idNegocio);
  return useMutation({
    mutationFn: api.borrarRespuesta,
    onSuccess: async () => {
      aviso.exito("Respuesta borrada");
      await recargar();
    },
  });
}

/** El 409 (ya reportada) lo avisa el manejo global; el diálogo se cierra igual y la lista se recarga. */
export function useReportar(idNegocio: number) {
  const recargar = useRecargar(idNegocio);
  return useMutation({
    mutationFn: ({ idResena, ...body }: api.ReporteBody & { idResena: number }) =>
      api.reportarResena(idResena, body),
    onSettled: recargar,
  });
}
