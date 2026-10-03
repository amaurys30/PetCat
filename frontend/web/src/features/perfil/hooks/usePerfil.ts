import { useMutation } from "@tanstack/react-query";
import * as authApi from "@/api/auth";
import { avisarPerfilCambiado } from "@/api/sesion";
import { useAuth } from "@/stores/auth";

/** Recarga el perfil en esta pestaña y avisa a las demás (avatar y nombre del menú). */
function useAlCambiarPerfil() {
  const recargarUsuario = useAuth((s) => s.recargarUsuario);
  return async () => {
    await recargarUsuario();
    avisarPerfilCambiado();
  };
}

const meta = { avisarError: false } as const;

export function useActualizarPerfil() {
  const alCambiar = useAlCambiarPerfil();
  return useMutation({ meta, mutationFn: authApi.actualizarPerfil, onSuccess: alCambiar });
}

export function useFotoPerfil() {
  const alCambiar = useAlCambiarPerfil();
  const subir = useMutation({
    meta,
    mutationFn: ({ archivo, onProgreso }: { archivo: File; onProgreso: (p: number) => void }) =>
      authApi.subirFoto(archivo, onProgreso),
    onSuccess: alCambiar,
  });
  const quitar = useMutation({ meta, mutationFn: authApi.eliminarFoto, onSuccess: alCambiar });
  return { subir, quitar };
}

export function useCambiarPassword() {
  return useMutation({ meta, mutationFn: authApi.cambiarPassword });
}
