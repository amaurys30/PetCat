import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/notificaciones";
import { aviso } from "@/components/ui/toaster";
import { queryKeys } from "@/lib/queryKeys";

/** Contador de la campana (solo las del panel). El tiempo real lo mantiene al día. */
export function useNoLeidas() {
  return useQuery({ queryKey: queryKeys.notificaciones.noLeidas(), queryFn: api.getNoLeidas });
}

const POR_PAGINA = 20;
export const RECIENTES = 6;

/** Las más recientes, para el desplegable de la campana. */
export function useRecientes(habilitada: boolean) {
  return useQuery({
    queryKey: queryKeys.notificaciones.lista({ recientes: true }),
    queryFn: () => api.getNotificaciones({ page: 1, limit: RECIENTES }),
    enabled: habilitada,
  });
}

/** Página "Todas las notificaciones", de 20 en 20. */
export function useListaNotificaciones(soloNoLeidas: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.notificaciones.lista({ soloNoLeidas }),
    queryFn: ({ pageParam }) => api.getNotificaciones({ page: pageParam, limit: POR_PAGINA, soloNoLeidas }),
    initialPageParam: 1,
    getNextPageParam: ({ meta }) => (meta.hasNext ? meta.page + 1 : undefined),
  });
}

/** Al marcar, el contador baja enseguida; después se recargan las listas. */
export function useMarcarLeida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (n: api.Notificacion) => api.marcarLeida(n.id_notificacion),
    onMutate: (n) => {
      if (n.leida) return;
      queryClient.setQueryData<api.NoLeidas>(queryKeys.notificaciones.noLeidas(), (actual) =>
        actual ? { ...actual, total: Math.max(0, actual.total - 1) } : actual,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.todas() }),
  });
}

export function useLeerTodas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.leerTodas,
    onSuccess: ({ actualizadas }) => {
      aviso.exito(
        actualizadas === 1
          ? "1 notificación marcada como leída"
          : `${actualizadas} notificaciones marcadas como leídas`,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.todas() }),
  });
}
