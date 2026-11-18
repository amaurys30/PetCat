import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/api/errors";

export function crearQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Reintentar solo fallos de red o del servidor: un 4xx no cambia al repetirlo.
        retry: (intentos, error) =>
          intentos < 2 && (!(error instanceof ApiError) || error.sinConexion || error.status >= 500),
      },
    },
  });
}

export const queryClient = crearQueryClient();
