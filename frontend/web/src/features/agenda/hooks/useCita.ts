import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/citas";
import { toApiError, type ApiError } from "@/api/errors";
import { queryKeys } from "@/lib/queryKeys";
import { abrirLimitePlanSiAplica } from "../errores";

export function useCita(idNegocio: number, idCita: number | undefined) {
  return useQuery({
    queryKey: queryKeys.citas.detalle(idNegocio, idCita ?? 0),
    queryFn: () => api.getCita(idCita!),
    enabled: idCita !== undefined,
  });
}

export function useHistorialCita(idNegocio: number, idCita: number | undefined) {
  return useQuery({
    queryKey: queryKeys.citas.historial(idNegocio, idCita ?? 0),
    queryFn: () => api.getHistorialCita(idCita!),
    enabled: idCita !== undefined,
  });
}

export function useProfesionalesLibres(idNegocio: number, idCita: number, habilitada: boolean) {
  return useQuery({
    queryKey: queryKeys.citas.libres(idNegocio, idCita),
    queryFn: () => api.getProfesionalesLibres(idCita),
    enabled: habilitada,
    staleTime: 0,
  });
}

export function useHorariosLibres(idNegocio: number, consulta: api.ConsultaHorarios | null) {
  return useQuery({
    queryKey: queryKeys.citas.horarios(idNegocio, consulta ?? {}),
    queryFn: () => api.getHorariosLibresPanel(idNegocio, consulta!),
    enabled: consulta !== null,
    staleTime: 0,
  });
}

/** Los diálogos muestran sus errores (409 con el motivo, 422 por campo). */
const meta = { avisarError: false } as const;

/**
 * Toda acción recarga la agenda, la atención, el detalle y el historial del negocio, y los
 * clientes y la ficha de la mascota (traen las citas, el cumplimiento y la próxima cita).
 */
function useRecargar(idNegocio: number) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.citas.todas(idNegocio) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.clientes.todos(idNegocio) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.salud.todo(idNegocio) }),
    ]);
}

export function useCambiarEstado(idNegocio: number) {
  const recargar = useRecargar(idNegocio);
  return useMutation({
    meta,
    mutationFn: ({ idCita, ...body }: api.CambiarEstadoBody & { idCita: number }) =>
      api.cambiarEstadoCita(idCita, body),
    onError: abrirLimitePlanSiAplica,
    onSettled: recargar,
  });
}

/**
 * Error de "Completar" desde confirmada cuando la cita ya quedó en curso y falló el segundo
 * paso: se reintenta desde ahí (solo completar).
 */
export class CompletarIncompleto extends Error {
  readonly causa: ApiError;
  constructor(causa: ApiError) {
    super(causa.message);
    this.causa = causa;
  }
}

/**
 * B8 · Completar. Desde confirmada (ya empezó) hace las dos llamadas seguidas: en curso y
 * completada. Si la segunda falla, la cita queda en curso y lanza CompletarIncompleto.
 */
export function useCompletar(idNegocio: number) {
  const recargar = useRecargar(idNegocio);
  return useMutation({
    meta,
    mutationFn: async ({ cita, precioFinal }: { cita: api.CitaPanelDetalle; precioFinal: number }) => {
      if (cita.estado === "confirmada") {
        await api.cambiarEstadoCita(cita.id_cita, { estado: "en_curso" });
        try {
          return await api.cambiarEstadoCita(cita.id_cita, {
            estado: "completada",
            precio_final: precioFinal,
          });
        } catch (error) {
          throw new CompletarIncompleto(toApiError(error));
        }
      }
      return api.cambiarEstadoCita(cita.id_cita, { estado: "completada", precio_final: precioFinal });
    },
    onError: abrirLimitePlanSiAplica,
    onSettled: recargar,
  });
}

export function useCancelarCita(idNegocio: number) {
  const recargar = useRecargar(idNegocio);
  return useMutation({
    meta,
    mutationFn: ({ idCita, motivo }: { idCita: number; motivo: string }) => api.cancelarCita(idCita, motivo),
    onError: abrirLimitePlanSiAplica,
    onSettled: recargar,
  });
}

export function useReprogramarCita(idNegocio: number) {
  const recargar = useRecargar(idNegocio);
  return useMutation({
    meta,
    mutationFn: ({ idCita, ...body }: api.ReprogramarBody & { idCita: number }) =>
      api.reprogramarCita(idCita, body),
    onError: abrirLimitePlanSiAplica,
    onSettled: recargar,
  });
}

export function useActualizarCita(idNegocio: number) {
  const recargar = useRecargar(idNegocio);
  return useMutation({
    meta,
    mutationFn: ({ idCita, ...body }: api.ActualizarCitaBody & { idCita: number }) =>
      api.actualizarCita(idCita, body),
    onError: abrirLimitePlanSiAplica,
    onSettled: recargar,
  });
}

/** B5 · Agendar desde el panel (queda confirmada). */
export function useCrearCita(idNegocio: number) {
  const recargar = useRecargar(idNegocio);
  return useMutation({
    meta,
    mutationFn: (body: api.CrearCitaPanelBody) => api.crearCitaPanel(idNegocio, body),
    onError: abrirLimitePlanSiAplica,
    onSettled: recargar,
  });
}
