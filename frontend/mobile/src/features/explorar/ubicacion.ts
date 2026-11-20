import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";

import type { Coordenada } from "./mapa/protocolo";

/**
 * - pendiente: aún no se pidió (la pantalla explica para qué antes de pedirlo).
 * - concedido: hay permiso (y, si se pudo leer, coordenada).
 * - negado: lo negó, pero se puede volver a pedir.
 * - bloqueado: lo negó del todo; solo se activa en Ajustes.
 */
export type PermisoUbicacion = "verificando" | "pendiente" | "concedido" | "negado" | "bloqueado";

const LIMITE_MS = 10_000;

const conLimite = <T>(promesa: Promise<T>) =>
  Promise.race([promesa, new Promise<null>((listo) => setTimeout(() => listo(null), LIMITE_MS))]);

async function leerPosicion(): Promise<Coordenada | null> {
  try {
    // La última conocida es inmediata; si no hay, se pide una (precisión media: menos batería).
    const ultima = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
    const posicion =
      ultima ?? (await conLimite(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })));
    return posicion ? { lat: posicion.coords.latitude, lng: posicion.coords.longitude } : null;
  } catch {
    return null;
  }
}

const estadoDe = (p: Location.LocationPermissionResponse): PermisoUbicacion =>
  p.granted
    ? "concedido"
    : p.status === Location.PermissionStatus.UNDETERMINED
      ? "pendiente"
      : p.canAskAgain
        ? "negado"
        : "bloqueado";

/** Ubicación del teléfono, solo con la app abierta (sin seguimiento en segundo plano). */
export function useUbicacion() {
  const [permiso, setPermiso] = useState<PermisoUbicacion>("verificando");
  const [coordenada, setCoordenada] = useState<Coordenada | null>(null);
  const [buscando, setBuscando] = useState(false);

  const obtener = useCallback(async () => {
    setBuscando(true);
    setCoordenada(await leerPosicion());
    setBuscando(false);
  }, []);

  useEffect(() => {
    let vigente = true;
    Location.getForegroundPermissionsAsync()
      .then((p) => {
        if (!vigente) return;
        const estado = estadoDe(p);
        setPermiso(estado);
        if (estado === "concedido") void obtener();
      })
      .catch(() => vigente && setPermiso("negado"));
    return () => {
      vigente = false;
    };
  }, [obtener]);

  /** Pide el permiso (después de explicarlo) y, si lo da, lee la posición. */
  const pedir = useCallback(async () => {
    try {
      const estado = estadoDe(await Location.requestForegroundPermissionsAsync());
      setPermiso(estado);
      if (estado === "concedido") await obtener();
      return estado;
    } catch {
      setPermiso("negado");
      return "negado" as const;
    }
  }, [obtener]);

  return { permiso, coordenada, buscando, pedir, actualizar: obtener };
}
