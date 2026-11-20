import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/api/errors";

export function crearQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Igual que la vigencia de la caché guardada (24 h): si no, se descarta antes de guardarla.
        gcTime: 24 * 60 * 60 * 1000,
        // Reintentar solo fallos de red o del servidor: un 4xx no cambia al repetirlo.
        retry: (intentos, error) =>
          intentos < 2 && (!(error instanceof ApiError) || error.sinConexion || error.status >= 500),
      },
    },
  });
}

export const queryClient = crearQueryClient();
