import { useMutation, useQuery } from "@tanstack/react-query";
import * as invitacionesApi from "@/api/invitaciones";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/stores/auth";

export function useInvitacion(token: string, habilitada: boolean) {
  return useQuery({
    queryKey: queryKeys.invitacion(token),
    queryFn: () => invitacionesApi.getInvitacion(token),
    enabled: habilitada,
    // Al aceptarla deja de ser válida: no volver a pedirla al enfocar la ventana.
    refetchOnWindowFocus: false,
  });
}

/** Acepta e inicia sesión con la cuenta invitada, cerrando antes la sesión que hubiera. */
export function useAceptarInvitacion(token: string) {
  const reemplazar = useAuth((s) => s.reemplazar);
  return useMutation({
    meta: { avisarError: false },
    mutationFn: async (body: invitacionesApi.AceptarInvitacionBody) => {
      const sesion = await invitacionesApi.aceptarInvitacion(token, body);
      return reemplazar(sesion);
    },
  });
}
