import { useState } from "react";
import type { CitaPanelDetalle } from "@/api/citas";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { hora } from "@/lib/format";
import { cn } from "@/lib/utils";
import { mensajeDeError } from "../../errores";
import { useActualizarCita, useProfesionalesLibres } from "../../hooks/useCita";
import { nombreCompleto } from "../../textos";
import { ResumenCita } from "./ResumenCita";

/**
 * Reasignar a otro profesional que atiende el servicio y está libre a la hora de la cita
 * (la API lo calcula con la disponibilidad y sus otras citas). Un 409 recarga la lista.
 */
export function ReasignarDialog({
  idNegocio,
  cita,
  onCerrar,
  onListo,
}: {
  idNegocio: number;
  cita: CitaPanelDetalle;
  onCerrar: () => void;
  onListo: (cita: CitaPanelDetalle) => void;
}) {
  const libres = useProfesionalesLibres(idNegocio, cita.id_cita, true);
  const actualizar = useActualizarCita(idNegocio);
  const [elegido, setElegido] = useState<number | null>(null);
  const nombreElegido = libres.data?.profesionales.find((p) => p.id_empleado === elegido);
  const error = mensajeDeError(actualizar.error) ?? (libres.isError ? libres.error.message : null);

  const enviar = () => {
    if (elegido === null) return;
    actualizar.mutate(
      { idCita: cita.id_cita, id_empleado: elegido },
      {
        onSuccess: onListo,
        onError: (e) => {
          if (e.status === 409) {
            setElegido(null);
            void libres.refetch();
          }
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-[520px]">
        <DialogTitle>Reasignar profesional</DialogTitle>
        <DialogDescription className="mt-1">
          Quién puede atenderla a las {hora(cita.hora_inicio)}, con su disponibilidad y sus otras citas.
        </DialogDescription>
        <div className="mt-4 flex flex-col gap-3">
          <ResumenCita cita={cita} />
          {!libres.data ? (
            libres.isError ? null : (
              <Skeleton className="h-28" />
            )
          ) : libres.data.profesionales.length === 0 ? (
            <Alert tono="advertencia">
              Nadie más atiende este servicio. Asígnalo a más profesionales en Servicios.
            </Alert>
          ) : (
            <div role="radiogroup" aria-label="Profesional" className="flex flex-col gap-2">
              {libres.data.profesionales.map((p) => {
                const disponible = p.libre && !p.actual;
                return (
                  <button
                    key={p.id_empleado}
                    type="button"
                    role="radio"
                    aria-checked={elegido === p.id_empleado}
                    disabled={!disponible}
                    onClick={() => setElegido(p.id_empleado)}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-control border p-3 text-left disabled:cursor-not-allowed",
                      elegido === p.id_empleado ? "border-primary bg-selected" : "hover:bg-surface",
                      !disponible && "bg-surface",
                    )}
                  >
                    <span className="min-w-0">
                      <span className={cn("block font-semibold", disponible ? "text-ink" : "text-muted")}>
                        {nombreCompleto(p)}
                      </span>
                      {!p.libre && <span className="block text-label text-muted">{p.motivo}</span>}
                    </span>
                    {p.actual ? <Badge>Actual</Badge> : p.libre ? <Badge tono="primary">Libre</Badge> : null}
                  </button>
                );
              })}
            </div>
          )}
          {error && <Alert tono="error">{error}</Alert>}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onCerrar}>
            Volver
          </Button>
          <Button disabled={elegido === null} cargando={actualizar.isPending} onClick={enviar}>
            {nombreElegido ? `Reasignar a ${nombreCompleto(nombreElegido)}` : "Reasignar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
