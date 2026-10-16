import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { Atencion, CitaPanel } from "@/api/citas";
import type { ApiError } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { encabezadoDia } from "@/lib/agenda";
import { hora } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TipoAccionCita } from "@/stores/ui";
import { nombreCompleto, textoMotivoFuera, textoPlazo } from "../textos";

/**
 * Panel lateral de la agenda: "Por confirmar" (con el tiempo que queda antes de la
 * cancelación automática) y "Fuera de disponibilidad". No depende de la semana que se ve:
 * la API las da todas desde hoy. Cada tarjeta abre la cita y trae sus acciones: Confirmar y
 * Rechazar, o Reasignar y Reprogramar, según el rol.
 */
export function PanelAtencion({
  atencion,
  error,
  ahora,
  idSeleccionada,
  onAbrir,
  permisos,
  onConfirmar,
  confirmando,
  onAccion,
}: {
  atencion: Atencion | undefined;
  error: ApiError | null;
  ahora: Date;
  idSeleccionada?: number;
  onAbrir: (cita: CitaPanel) => void;
  permisos: { editar: boolean; cancelar: boolean };
  onConfirmar: (cita: CitaPanel) => void;
  /** Cita que se está confirmando (su botón muestra que espera). */
  confirmando?: number;
  onAccion: (tipo: TipoAccionCita, cita: CitaPanel) => void;
}) {
  if (error) {
    return (
      <Card className="p-4 text-body text-muted" role="alert">
        No se pudieron cargar las citas por confirmar. {error.message}
      </Card>
    );
  }
  if (!atencion) {
    return (
      <Card className="flex flex-col gap-3 p-4" aria-busy>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </Card>
    );
  }

  const { por_confirmar: porConfirmar, fuera_de_disponibilidad: fuera } = atencion;
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <h3 className="text-card font-semibold text-ink">Por confirmar ({porConfirmar.length})</h3>
        {porConfirmar.length === 0 ? (
          <p className="mt-2 text-body text-muted">No hay citas por confirmar.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2" aria-label="Citas por confirmar">
            {porConfirmar.map((c) => (
              <li key={c.id_cita}>
                <Tarjeta
                  cita={c}
                  seleccionada={c.id_cita === idSeleccionada}
                  onAbrir={onAbrir}
                  acciones={
                    (permisos.editar || permisos.cancelar) && (
                      <>
                        {permisos.editar && (
                          <Button
                            size="sm"
                            cargando={confirmando === c.id_cita}
                            onClick={() => onConfirmar(c)}
                          >
                            Confirmar
                          </Button>
                        )}
                        {permisos.cancelar && (
                          <Button size="sm" variant="secondary" onClick={() => onAccion("rechazar", c)}>
                            Rechazar
                          </Button>
                        )}
                      </>
                    )
                  }
                >
                  <span className="block truncate font-semibold text-ink">
                    {c.mascota.nombre} · {c.servicio.nombre}
                  </span>
                  <span className="block truncate text-label text-muted">
                    {encabezadoDia(c.fecha)} · {hora(c.hora_inicio)} · {nombreCompleto(c.cliente)}
                  </span>
                  {textoPlazo(c, ahora) && (
                    <span className="mt-1 block text-label font-semibold text-warning-ink">
                      {textoPlazo(c, ahora)}
                    </span>
                  )}
                </Tarjeta>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {fuera.length > 0 && (
        <Card className="p-4">
          <h3 className="flex items-center gap-1.5 text-card font-semibold text-ink">
            <TriangleAlert className="size-4 text-warning" aria-hidden />
            Fuera de disponibilidad ({fuera.length})
          </h3>
          <ul className="mt-3 flex flex-col gap-2" aria-label="Citas fuera de disponibilidad">
            {fuera.map((c) => (
              <li key={c.id_cita}>
                <Tarjeta
                  cita={c}
                  seleccionada={c.id_cita === idSeleccionada}
                  onAbrir={onAbrir}
                  acciones={
                    permisos.editar && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => onAccion("reasignar", c)}>
                          Reasignar
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => onAccion("reprogramar", c)}>
                          Reprogramar
                        </Button>
                      </>
                    )
                  }
                >
                  <span className="block truncate font-semibold text-ink">
                    {c.mascota.nombre} · {encabezadoDia(c.fecha)} {hora(c.hora_inicio)}
                  </span>
                  <span className="block text-label text-muted">{textoMotivoFuera(c)}.</span>
                </Tarjeta>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Tarjeta({
  cita,
  seleccionada,
  onAbrir,
  acciones,
  children,
}: {
  cita: CitaPanel;
  seleccionada: boolean;
  onAbrir: (cita: CitaPanel) => void;
  acciones: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-control bg-surface", seleccionada && "ring-2 ring-primary")}>
      <button
        type="button"
        onClick={() => onAbrir(cita)}
        aria-pressed={seleccionada}
        className="w-full rounded-control p-3 text-left text-body hover:bg-selected"
      >
        {children}
      </button>
      {acciones && <div className="flex flex-wrap gap-2 px-3 pb-3">{acciones}</div>}
    </div>
  );
}
