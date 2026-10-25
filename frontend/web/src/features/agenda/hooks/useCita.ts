import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/citas";
import { toApiError, type ApiError } from "@/api/errors";
import { queryKeys } from "@/lib/queryKeys";
import { aviso } from "@/components/ui/toaster";
import { fechaHoraCita } from "@/lib/agenda";
import { abrirLimitePlanSiAplica } from "../errores";
import { nombreProfesional } from "../textos";

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

/** Aviso de cada cambio de estado (completar tiene su propio hook). */
const AVISO_ESTADO: Partial<Record<api.EstadoCita, (c: api.CitaPanelDetalle) => string>> = {
  confirmada: (c) => `Cita de ${c.mascota.nombre} confirmada`,
  en_curso: () => "Cita en curso",
  no_asistio: () => "Inasistencia registrada",
};

export function useCambiarEstado(idNegocio: number) {
  const recargar = useRecargar(idNegocio);
  return useMutation({
    meta,
    mutationFn: ({ idCita, ...body }: api.CambiarEstadoBody & { idCita: number }) =>
      api.cambiarEstadoCita(idCita, body),
    onSuccess: (cita, { estado }) => {
      const texto = AVISO_ESTADO[estado]?.(cita);
      if (texto) aviso.exito(texto);
    },
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
    onSuccess: () => aviso.exito("Cita completada"),
    onError: abrirLimitePlanSiAplica,
    onSettled: recargar,
  });
}

export function useCancelarCita(idNegocio: number) {
  const recargar = useRecargar(idNegocio);
  return useMutation({
    meta,
    mutationFn: ({ idCita, motivo }: { idCita: number; motivo: string; rechazar?: boolean }) =>
      api.cancelarCita(idCita, motivo),
    onSuccess: (_cita, { rechazar }) => aviso.exito(rechazar ? "Cita rechazada" : "Cita cancelada"),
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
    onSuccess: (nueva) => aviso.exito(`Cita reprogramada: ${fechaHoraCita(nueva.fecha, nueva.hora_inicio)}`),
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
    // Reasignar (B4) o guardar las notas internas.
    onSuccess: (cita, cambios) =>
      aviso.exito(
        "id_empleado" in cambios ? `Cita reasignada a ${nombreProfesional(cita)}` : "Notas guardadas",
      ),
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
    onSuccess: (cita) =>
      aviso.exito(
        `Cita agendada y confirmada: ${cita.mascota.nombre}, ${fechaHoraCita(cita.fecha, cita.hora_inicio)}`,
      ),
    onError: abrirLimitePlanSiAplica,
    onSettled: recargar,
  });
}
