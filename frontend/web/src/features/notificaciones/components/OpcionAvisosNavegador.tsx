import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aviso } from "@/components/ui/toaster";
import { activarAvisos, desactivarAvisos, useEstadoAvisos } from "../avisosNavegador";

/**
 * "Activar avisos en este navegador": con la pestaña oculta, una reserva nueva por confirmar
 * se avisa con un aviso del sistema operativo (texto genérico, sin datos del cliente).
 */
export function OpcionAvisosNavegador() {
  const estado = useEstadoAvisos();
  if (estado === "no_soportado") return null;

  if (estado === "bloqueado") {
    return (
      <p className="text-label text-muted">
        Bloqueaste los avisos de PetCat en este navegador. Para recibirlos, permítelos en la configuración del
        sitio.
      </p>
    );
  }
  if (estado === "activos") {
    return (
      <p className="flex items-center justify-between gap-2 text-label text-muted">
        <span className="flex items-center gap-1.5">
          <BellRing className="size-3.5 text-primary" aria-hidden />
          Avisos activos en este navegador
        </span>
        <Button variant="link" size="sm" onClick={desactivarAvisos}>
          Desactivar
        </Button>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() =>
          void activarAvisos().then((nuevo) => {
            if (nuevo === "activos")
              aviso.exito("Te avisaremos de las reservas nuevas aunque la pestaña esté oculta");
          })
        }
      >
        <BellRing /> Activar avisos en este navegador
      </Button>
      <p className="text-label text-subtle">
        Para las reservas nuevas por confirmar, cuando la pestaña no está a la vista.
      </p>
    </div>
  );
}
