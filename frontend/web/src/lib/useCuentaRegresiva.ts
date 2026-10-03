import { useCallback, useEffect, useState } from "react";

/** Segundos que faltan para volver a permitir una acción (reenviar un correo). */
export function useCuentaRegresiva(): [number, (segundos: number) => void] {
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    if (segundos <= 0) return;
    const id = setTimeout(() => setSegundos((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [segundos]);

  const iniciar = useCallback((s: number) => setSegundos(s), []);
  return [segundos, iniciar];
}
