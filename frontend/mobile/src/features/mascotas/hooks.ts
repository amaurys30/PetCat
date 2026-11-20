import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import {
  deleteFotoMascota,
  deleteMascota,
  getMascota,
  getMascotas,
  getPesos,
  patchMascota,
  postMascota,
  putFotoMascota,
} from "@/api/mascotas";
import type { CambiosMascota, DatosMascota, MascotaConResumen } from "@/api/types";
import { queryKeys } from "@/lib/queryKeys";
import { useMascotaSeleccionada } from "@/store/mascotaSeleccionada";
import { useIdUsuario, useSesion } from "@/store/sesion";

export function useMascotas() {
  return useQuery({ queryKey: queryKeys.mascotas.lista(), queryFn: getMascotas });
}

/** Detalle con resumen; mientras llega, la mascota de la lista (si ya está en caché). */
export function useMascota(id_mascota: number) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.mascotas.detalle(id_mascota),
    queryFn: () => getMascota(id_mascota),
    placeholderData: () =>
      queryClient
        .getQueryData<MascotaConResumen[]>(queryKeys.mascotas.lista())
        ?.find((m) => m.id_mascota === id_mascota),
  });
}

export function usePesos(id_mascota: number, meses = 12) {
  return useQuery({
    queryKey: queryKeys.mascotas.pesos(id_mascota, meses),
    queryFn: () => getPesos(id_mascota, meses),
  });
}

/** Sin conexión (abrió con datos guardados): las pantallas no dejan escribir. */
export const useSoloLectura = () => useSesion((s) => s.modoSinConexion);

function useRefrescarMascotas() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.mascotas.todas() });
}

export function useCrearMascota() {
  const refrescar = useRefrescarMascotas();
  return useMutation({ mutationFn: (datos: DatosMascota) => postMascota(datos), onSuccess: refrescar });
}

export function useEditarMascota(id_mascota: number) {
  const refrescar = useRefrescarMascotas();
  return useMutation({
    mutationFn: (cambios: CambiosMascota) => patchMascota(id_mascota, cambios),
    onSuccess: refrescar,
  });
}

export function useEliminarMascota(id_mascota: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteMascota(id_mascota),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: queryKeys.mascotas.detalle(id_mascota) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.mascotas.lista() });
    },
  });
}

export function useSubirFoto(id_mascota: number) {
  const refrescar = useRefrescarMascotas();
  return useMutation({ mutationFn: (uri: string) => putFotoMascota(id_mascota, uri), onSuccess: refrescar });
}

export function useQuitarFoto(id_mascota: number) {
  const refrescar = useRefrescarMascotas();
  return useMutation({ mutationFn: () => deleteFotoMascota(id_mascota), onSuccess: refrescar });
}

/**
 * Mascota de Inicio: la guardada si sigue viva en la lista y es de esta cuenta; si no (se
 * eliminó, falleció, o es otra cuenta), la primera viva. Sin mascotas vivas, null.
 */
export function useMascotaActual(mascotas: MascotaConResumen[] | undefined) {
  const id_usuario = useIdUsuario();
  const guardada = useMascotaSeleccionada();
  const vivas = useMemo(() => (mascotas ?? []).filter((m) => !m.fallecido), [mascotas]);
  const actual =
    (guardada.id_usuario === id_usuario
      ? vivas.find((m) => m.id_mascota === guardada.id_mascota)
      : undefined) ??
    vivas[0] ??
    null;

  useEffect(() => {
    if (
      actual &&
      id_usuario &&
      (guardada.id_mascota !== actual.id_mascota || guardada.id_usuario !== id_usuario)
    ) {
      guardada.seleccionar(id_usuario, actual.id_mascota);
    }
  }, [actual, id_usuario, guardada]);

  const seleccionar = (id_mascota: number) => {
    if (id_usuario) guardada.seleccionar(id_usuario, id_mascota);
  };
  return { actual, vivas, seleccionar };
}
