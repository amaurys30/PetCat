import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as negociosApi from "@/api/negocios";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/stores/auth";
import { useUi } from "@/stores/ui";

/** Negocio del panel con sus sedes, horarios y reglas de confirmación (configuracion.ver). */
export function useGestion(idNegocio: number, habilitada = true) {
  return useQuery({
    queryKey: queryKeys.negocios.gestion(idNegocio),
    queryFn: () => negociosApi.getGestion(idNegocio),
    enabled: habilitada,
  });
}

export function usePlanes() {
  return useQuery({ queryKey: queryKeys.planes(), queryFn: negociosApi.getPlanes, staleTime: Infinity });
}

/**
 * Después de cambiar el negocio o sus sedes: la vista de gestión y el perfil (`/auth/me`
 * trae nombre, logo y `configuracion_pendiente` de cada negocio).
 */
function useRefrescarNegocio(idNegocio: number) {
  const queryClient = useQueryClient();
  const recargarUsuario = useAuth((s) => s.recargarUsuario);
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.negocios.gestion(idNegocio) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.negocios.suscripcion(idNegocio) }),
      recargarUsuario(),
    ]);
  };
}

/** Los formularios muestran sus errores (422 por campo y el mensaje de la API). */
const meta = { avisarError: false } as const;

export function useCrearNegocio() {
  const recargarUsuario = useAuth((s) => s.recargarUsuario);
  return useMutation({
    meta,
    mutationFn: async (body: negociosApi.CrearNegocioBody) => {
      const negocio = await negociosApi.crearNegocio(body);
      await recargarUsuario();
      return negocio;
    },
  });
}

export function useActualizarNegocio(idNegocio: number) {
  const refrescar = useRefrescarNegocio(idNegocio);
  return useMutation({
    meta,
    mutationFn: (body: negociosApi.ActualizarNegocioBody) => negociosApi.actualizarNegocio(idNegocio, body),
    onSuccess: refrescar,
  });
}

export type GuardarSede =
  | { nueva: negociosApi.CrearSucursalBody }
  | { idSucursal: number; cambios: negociosApi.ActualizarSucursalBody };

/** Crea una sede o actualiza una existente. El 403 del límite del plan abre su diálogo. */
export function useGuardarSede(idNegocio: number) {
  const refrescar = useRefrescarNegocio(idNegocio);
  return useMutation({
    mutationFn: (datos: GuardarSede) =>
      "nueva" in datos
        ? negociosApi.crearSucursal(idNegocio, datos.nueva)
        : negociosApi.actualizarSucursal(datos.idSucursal, datos.cambios),
    onSuccess: refrescar,
  });
}

export function useEliminarSede(idNegocio: number) {
  const refrescar = useRefrescarNegocio(idNegocio);
  return useMutation({
    meta,
    mutationFn: (idSucursal: number) => negociosApi.eliminarSucursal(idSucursal),
    onSuccess: refrescar,
  });
}

/**
 * Guarda la semana de una sede. Las citas que quedaron fuera se muestran aquí, antes de
 * recargar el perfil: si la semana queda sin horario, el propietario vuelve al asistente
 * y la pantalla que guardó ya no existe para mostrarlas.
 */
export function useGuardarHorarios(idNegocio: number) {
  const refrescar = useRefrescarNegocio(idNegocio);
  return useMutation({
    meta,
    mutationFn: ({
      idSucursal,
      horarios,
    }: {
      idSucursal: number;
      horarios: negociosApi.HorariosBody["horarios"];
    }) => negociosApi.guardarHorarios(idSucursal, { horarios }),
    onSuccess: ({ citas_afectadas }) => {
      useUi.getState().mostrarCitasAfectadas(citas_afectadas);
      return refrescar();
    },
  });
}

/** Logo o banner del negocio. Los errores los muestra el subidor (422 de archivo, 429, 503). */
export function useImagenNegocio(idNegocio: number, tipo: negociosApi.TipoImagen) {
  const refrescar = useRefrescarNegocio(idNegocio);
  const subir = useMutation({
    meta,
    mutationFn: ({ archivo, onProgreso }: { archivo: File; onProgreso: (p: number) => void }) =>
      negociosApi.subirImagenNegocio(idNegocio, tipo, archivo, onProgreso),
    onSuccess: refrescar,
  });
  const quitar = useMutation({
    meta,
    mutationFn: () => negociosApi.eliminarImagenNegocio(idNegocio, tipo),
    onSuccess: refrescar,
  });
  return { subir, quitar };
}
