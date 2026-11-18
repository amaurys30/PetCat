import NetInfo from "@react-native-community/netinfo";
import { useCallback, useEffect, useRef, useState } from "react";

import { restaurarSesion } from "./acciones";

export type FaseArranque = "cargando" | "listo" | "sin_conexion";

/**
 * Restaura la sesión una vez al abrir la app. Sin conexión, expone `reintentar` y reintenta
 * solo cuando la red vuelve (paso de desconectado a conectado; NetInfo avisa también al
 * suscribirse, y reintentar con ese aviso haría un bucle si el servidor está caído).
 */
export function useArranque() {
  const [fase, setFase] = useState<FaseArranque>("cargando");
  const [reintentando, setReintentando] = useState(false);
  const enCurso = useRef(false);

  const ejecutar = useCallback(async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    try {
      const resultado = await restaurarSesion();
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
    if (fase !== "sin_conexion") return;
    let conectadoAntes: boolean | null = null;
    return NetInfo.addEventListener((estado) => {
      const conectado = !!estado.isConnected && estado.isInternetReachable !== false;
      if (conectadoAntes === false && conectado) reintentar();
      conectadoAntes = conectado;
    });
  }, [fase, reintentar]);

  return { fase, reintentando, reintentar };
}
