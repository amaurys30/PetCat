import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/disponibilidad";
import { getPerfilPublico } from "@/api/negocios";
import { useGestion } from "@/features/negocios/hooks/useGestion";
import { useNegocioActivo, usePuede } from "@/features/negocios/hooks/useNegocio";
import { queryKeys } from "@/lib/queryKeys";

/** Los formularios muestran sus errores (422 por campo y el mensaje de la API). */
const meta = { avisarError: false } as const;

export function useDisponibilidad(idEmpleado: number) {
  return useQuery({
    queryKey: queryKeys.disponibilidad.todo(idEmpleado),
    queryFn: () => api.getDisponibilidad(idEmpleado),
  });
}

export function useDisponibilidadEfectiva(idEmpleado: number, fecha: string) {
  return useQuery({
    queryKey: queryKeys.disponibilidad.efectiva(idEmpleado, fecha),
    queryFn: () => api.getDisponibilidadEfectiva(idEmpleado, fecha),
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(fecha),
  });
}

export interface SedeHorario {
  id_sucursal: number;
  nombre: string;
  es_principal: boolean;
  horarios: { dia_semana: number; hora_apertura: string; hora_cierre: string }[];
}

/**
 * Sedes activas del negocio con su horario: de `/gestion` si el rol tiene configuracion.ver
 * (ya suele estar en caché) o del perfil público si no.
 */
export function useSedes(): { sedes: SedeHorario[] | undefined; cargando: boolean } {
  const negocio = useNegocioActivo();
  const puede = usePuede();
  const conGestion = puede("configuracion", "ver");
  const gestion = useGestion(negocio.id_negocio, conGestion);
  const publico = useQuery({
    queryKey: queryKeys.negocios.publico(negocio.id_negocio),
    queryFn: () => getPerfilPublico(negocio.id_negocio),
    enabled: !conGestion,
  });
  const fuente = conGestion ? gestion : publico;
  return { sedes: fuente.data?.sucursales, cargando: fuente.isPending };
}

function useRefrescar(idEmpleado: number) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.disponibilidad.todo(idEmpleado) });
}

export function useGuardarHorarioSemanal(idEmpleado: number) {
  const refrescar = useRefrescar(idEmpleado);
  return useMutation({
    meta,
    mutationFn: (horarios: api.RangoSemanal[]) => api.guardarHorarioSemanal(idEmpleado, horarios),
    onSuccess: refrescar,
  });
}

export type GuardarExcepcion =
  | { nueva: api.ExcepcionInput }
  | { idDisponibilidad: number; cambios: api.ActualizarExcepcionBody };

export function useGuardarExcepcion(idEmpleado: number) {
  const refrescar = useRefrescar(idEmpleado);
  return useMutation({
    meta,
    mutationFn: (datos: GuardarExcepcion) =>
      "nueva" in datos
        ? api.crearExcepcion(idEmpleado, datos.nueva)
        : api.actualizarExcepcion(datos.idDisponibilidad, datos.cambios),
    onSuccess: refrescar,
  });
}

export function useEliminarExcepcion(idEmpleado: number) {
  const refrescar = useRefrescar(idEmpleado);
  return useMutation({
    meta,
    mutationFn: (idDisponibilidad: number) => api.eliminarExcepcion(idDisponibilidad),
    onSuccess: refrescar,
  });
}
