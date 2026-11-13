import { useCallback, useEffect, useState } from "react";

const enfocar = (elemento: HTMLElement | null) => {
  // Solo si el foco quedó en ninguna parte: no se le quita a lo que el usuario eligió.
  const libre = !document.activeElement || document.activeElement === document.body;
  if (elemento?.isConnected && libre) elemento.focus();
};

/**
 * Devuelve el foco al elemento que abrió un diálogo o panel que se abre por estado o por la URL
 * (sin el Trigger de Radix, que lo hace solo). Se guarda al pintarse por primera vez, antes de
 * que el diálogo mueva el foco adentro. Pasar `onCloseAutoFocus` al Content cubre el cierre
 * con el componente montado; el efecto, el desmontaje.
 */
export function useFocoDeRegreso() {
  const [origen] = useState(() =>
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null),
  );

  useEffect(() => () => void requestAnimationFrame(() => enfocar(origen)), [origen]);

  const onCloseAutoFocus = useCallback(
    (evento: Event) => {
      if (!origen?.isConnected) return;
      evento.preventDefault();
      origen.focus();
    },
    [origen],
  );

  return { onCloseAutoFocus };
}
