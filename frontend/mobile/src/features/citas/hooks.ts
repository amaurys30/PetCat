import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

import {
  cancelarCita,
  getCita,
  getHorariosLibres,
  getMisCitas,
  postCita,
  reprogramarCita,
  type AlcanceCitas,
} from "@/api/citas";
import type { Cita, DatosReprogramacion, DatosReserva } from "@/api/types";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Sin Socket.IO en M5: lo que muestra una pantalla de citas se pide de nuevo cada vez que vuelve
 * a verse (además de deslizar hacia abajo). La primera vez no: ya lo pidió al montarse.
 */
export function useRefrescarAlVolver(refrescar: () => unknown) {
  const primera = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (primera.current) {
        primera.current = false;
        return;
      }
      void refrescar();
    }, [refrescar]),
  );
}

export function useHorariosLibres(
  params: { id_servicio: number; id_sucursal: number; fecha: string } | null,
) {
  return useQuery({
    queryKey: params
      ? queryKeys.citas.horarios(params.id_servicio, params.id_sucursal, params.fecha)
      : ["citas", "horarios", "ninguno"],
    queryFn: () => getHorariosLibres(params!),
    enabled: params !== null,
    // Las horas cambian con cada reserva: siempre se piden de nuevo al volver a un día.
    staleTime: 0,
  });
}

export function useMisCitas(alcance: AlcanceCitas) {
  return useInfiniteQuery({
    queryKey: queryKeys.citas.mias(alcance),
    queryFn: ({ pageParam }) => getMisCitas(alcance, pageParam),
    initialPageParam: 1,
    getNextPageParam: (ultima) => (ultima.meta.hasNext ? ultima.meta.page + 1 : undefined),
  });
}

export function useCita(id_cita: number) {
  return useQuery({
    queryKey: queryKeys.citas.detalle(id_cita),
    queryFn: () => getCita(id_cita),
    enabled: Number.isInteger(id_cita) && id_cita > 0,
  });
}

/** Tras reservar, cancelar o reprogramar: mis citas y la próxima cita de Inicio (resumen de mascotas). */
function useAlCambiarCita() {
  const queryClient = useQueryClient();
  return (cita: Cita) => {
    queryClient.setQueryData(queryKeys.citas.detalle(cita.id_cita), cita);
    void queryClient.invalidateQueries({
      queryKey: queryKeys.citas.todas(),
      predicate: (q) => !(q.queryKey[1] === "detalle" && q.queryKey[2] === cita.id_cita),
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.mascotas.todas() });
  };
}

export function useReservar() {
  const alCambiar = useAlCambiarCita();
  return useMutation({
    mutationFn: (datos: DatosReserva) => postCita(datos),
    // Nunca se reintenta sola: podría crear la cita dos veces.
    retry: false,
    onSuccess: ({ cita }) => alCambiar(cita),
  });
}

export function useReprogramar(id_cita: number) {
  const alCambiar = useAlCambiarCita();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: DatosReprogramacion) => reprogramarCita(id_cita, datos),
    retry: false,
    onSuccess: (nueva) => {
      alCambiar(nueva);
      // La original quedó reprogramada.
      void queryClient.invalidateQueries({ queryKey: queryKeys.citas.detalle(id_cita) });
    },
  });
}

export function useCancelar() {
  const alCambiar = useAlCambiarCita();
  return useMutation({
    mutationFn: (id_cita: number) => cancelarCita(id_cita),
    retry: false,
    onSuccess: alCambiar,
  });
}
