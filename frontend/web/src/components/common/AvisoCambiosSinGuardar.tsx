import { useEffect } from "react";
import { useBlocker } from "react-router";
import { ConfirmDialog } from "./ConfirmDialog";

/**
 * Con cambios sin guardar, pregunta antes de salir de la pantalla (navegación del panel)
 * y deja que el navegador avise al cerrar o recargar la pestaña.
 * `haySinGuardar` se consulta en el momento de salir (no al pintar): así, justo después
 * de guardar se puede navegar sin que pregunte.
 */
export function AvisoCambiosSinGuardar({ haySinGuardar }: { haySinGuardar: () => boolean }) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname + currentLocation.search !== nextLocation.pathname + nextLocation.search &&
      haySinGuardar(),
  );

  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => {
      if (haySinGuardar()) e.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [haySinGuardar]);

  return (
    <ConfirmDialog
      abierto={blocker.state === "blocked"}
      onAbiertoChange={(abierto) => !abierto && blocker.reset?.()}
      titulo="Tienes cambios sin guardar"
      descripcion="Si sales ahora, se perderán."
      confirmar="Salir sin guardar"
      cancelar="Seguir editando"
      peligro
      onConfirmar={() => blocker.proceed?.()}
    />
  );
}
