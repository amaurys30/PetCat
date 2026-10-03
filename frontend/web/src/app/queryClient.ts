import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toApiError, type ApiError } from "@/api/errors";
import { aviso } from "@/components/ui/toaster";
import { useUi } from "@/stores/ui";

declare module "@tanstack/react-query" {
  interface Register {
    defaultError: ApiError;
    mutationMeta: {
      /** false: la pantalla muestra el error ella misma (formularios de acceso, 422 por campo). */
      avisarError?: boolean;
    };
  }
}

/**
 * Manejo global de errores de las mutaciones (CLAUDE.md del panel):
 * 403 con `errors.plan` -> diálogo de límite del plan; 409 y 429 -> aviso de advertencia;
 * sin conexión y demás -> aviso de error. Los 422 los marca el formulario y los 401
 * los resuelve el cliente (renovación o cierre de sesión).
 */
export function avisarError(error: ApiError) {
  if (error.limitePlan) {
    useUi.getState().abrirLimitePlan(error.message);
    return;
  }
  if (error.status === 401 || (error.status === 422 && Object.keys(error.errors).length > 0)) return;
  if (error.status === 409 || error.status === 429) {
    aviso.advertencia(error.message);
    return;
  }
  aviso.error(error.message);
}

const reintentar = (fallos: number, error: ApiError) =>
  fallos < 2 && (error.sinConexion || (error.status ?? 0) >= 500);

export function crearQueryClient() {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, _variables, _contexto, mutacion) => {
        if (mutacion.meta?.avisarError === false) return;
        avisarError(toApiError(error));
      },
    }),
    defaultOptions: {
      queries: { staleTime: 30_000, retry: reintentar },
      mutations: { retry: false },
    },
  });
}

export const queryClient = crearQueryClient();
