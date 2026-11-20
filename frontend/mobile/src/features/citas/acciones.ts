import { AccessibilityInfo, Alert } from "react-native";

import { ApiError, MENSAJES } from "@/api/errors";
import type { Cita } from "@/api/types";
import { comoLlegar } from "@/features/explorar/components/TarjetaNegocio";

import { useCancelar } from "./hooks";
import { cancelacionTardia, HORAS_AVISO } from "./logica";

/** "Cómo llegar" a la sede de la cita (null si la sede no tiene coordenadas). */
export function accionComoLlegar(cita: Cita): (() => void) | null {
  const s = cita.sucursal;
  if (!s || s.latitud === null || s.longitud === null) return null;
  return () => comoLlegar(`${cita.negocio.nombre}, ${s.nombre}`, { lat: s.latitud!, lng: s.longitud! });
}

/**
 * Cancelar con confirmación (diálogo del sistema, accesible). Si faltan menos de 2 horas, avisa
 * que quedará como cancelación tardía (la API la registra y el negocio la ve).
 */
export function useCancelarConConfirmacion() {
  const cancelar = useCancelar();

  const pedir = (cita: Cita, alTerminar?: () => void) => {
    const tardia = cancelacionTardia(cita);
    const mensaje = [
      `${cita.servicio.nombre} para ${cita.mascota.nombre} en ${cita.negocio.nombre}.`,
      tardia
        ? `Faltan menos de ${HORAS_AVISO} horas: quedará como cancelación tardía y el negocio lo verá.`
        : null,
    ]
      .filter(Boolean)
      .join(" ");
    Alert.alert("¿Cancelar la cita?", mensaje, [
      { text: "No, mantenerla", style: "cancel" },
      {
        text: "Sí, cancelar",
        style: "destructive",
        onPress: () =>
          cancelar.mutate(cita.id_cita, {
            onSuccess: () => {
              AccessibilityInfo.announceForAccessibility("Cita cancelada");
              alTerminar?.();
            },
            onError: (e) =>
              Alert.alert("No se pudo cancelar", e instanceof ApiError ? e.message : MENSAJES.generico),
          }),
      },
    ]);
  };

  return { pedir, cancelando: cancelar.isPending ? cancelar.variables : null };
}
