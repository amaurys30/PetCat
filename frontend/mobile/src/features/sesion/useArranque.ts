import NetInfo from "@react-native-community/netinfo";
import { useCallback, useEffect, useRef, useState } from "react";

import { useSesion } from "@/store/sesion";

import { reconectar } from "./acciones";

export type FaseArranque = "cargando" | "listo" | "sin_conexion";

/**
 * Restaura la sesión una vez al abrir la app. Sin conexión y sin datos guardados: pantalla
 * "Sin conexión". Sin conexión con datos guardados: entra en modo sin conexión (aviso fijo).
 * En los dos casos reintenta solo cuando la red pasa de desconectada a conectada (NetInfo
 * avisa también al suscribirse, y reintentar con ese aviso haría un bucle con el servidor caído).
 */
export function useArranque() {
  const [fase, setFase] = useState<FaseArranque>("cargando");
  const [reintentando, setReintentando] = useState(false);
  const modoSinConexion = useSesion((s) => s.modoSinConexion);
  const enCurso = useRef(false);

  const ejecutar = useCallback(async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    try {
      const resultado = await reconectar();
      setFase(resultado === "sin_conexion" ? "sin_conexion" : "listo");
    } finally {
      enCurso.current = false;
    }
  }, []);

  const reintentar = useCallback(async () => {
    setReintentando(true);
    try {
      await ejecutar();
    } finally {
      setReintentando(false);
    }
  }, [ejecutar]);

  useEffect(() => {
    ejecutar();
  }, [ejecutar]);

  useEffect(() => {
    if (fase !== "sin_conexion" && !modoSinConexion) return;
    let conectadoAntes: boolean | null = null;
    return NetInfo.addEventListener((estado) => {
      const conectado = !!estado.isConnected && estado.isInternetReachable !== false;
      if (conectadoAntes === false && conectado) reintentar();
      conectadoAntes = conectado;
    });
  }, [fase, modoSinConexion, reintentar]);

  return { fase, reintentando, reintentar };
}
