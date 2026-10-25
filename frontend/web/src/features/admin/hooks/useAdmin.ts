import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/admin";
import { aviso } from "@/components/ui/toaster";
import { queryKeys } from "@/lib/queryKeys";

export const POR_PAGINA = 20;

export function useNegociosAdmin(filtros: api.FiltrosAdmin, page: number) {
  return useQuery({
    queryKey: queryKeys.admin.negocios({ ...filtros, page }),
    queryFn: () => api.getNegociosAdmin({ ...filtros, page, limit: POR_PAGINA }),
    placeholderData: keepPreviousData,
  });
}

export function useHistorialSuscripciones(idNegocio: number | null) {
  return useQuery({
    queryKey: queryKeys.admin.historial(idNegocio ?? 0),
    queryFn: () => api.getHistorialSuscripciones(idNegocio!),
    enabled: idNegocio !== null,
  });
}

/** El formulario marca los 422 por campo; el aviso de éxito va aquí (regla de CLAUDE.md). */
export function useAsignarPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { avisarError: false },
    mutationFn: ({ negocio, body }: { negocio: api.NegocioAdmin; body: api.AsignarPlanBody }) =>
      api.asignarPlan(negocio.id_negocio, body),
    onSuccess: (suscripcion, { negocio }) => {
      aviso.exito(`Plan ${suscripcion.plan.nombre} asignado a ${negocio.nombre}`);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.todo() }),
        // Si el admin también trabaja en ese negocio, su suscripción en el panel.
        queryClient.invalidateQueries({ queryKey: queryKeys.negocios.suscripcion(negocio.id_negocio) }),
      ]);
    },
  });
}
