import { useMutation, useQueryClient } from "@tanstack/react-query";
import { iniciarPruebaPro } from "@/api/negocios";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/stores/auth";

/**
 * Activa la prueba Pro. Cambian los límites y el plan de todo el negocio: la suscripción,
 * el dashboard y el plan de `/auth/me` (menú y selector de negocio). El 409 (ya la usó)
 * lo avisa el manejo global de errores.
 */
export function usePruebaPro(idNegocio: number) {
  const queryClient = useQueryClient();
  const recargarUsuario = useAuth((s) => s.recargarUsuario);
  return useMutation({
    mutationFn: () => iniciarPruebaPro(idNegocio),
    onSuccess: async (suscripcion) => {
      queryClient.setQueryData(queryKeys.negocios.suscripcion(idNegocio), suscripcion);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.todo(idNegocio) }),
        recargarUsuario(),
      ]);
    },
    onError: () => queryClient.invalidateQueries({ queryKey: queryKeys.negocios.suscripcion(idNegocio) }),
  });
}
