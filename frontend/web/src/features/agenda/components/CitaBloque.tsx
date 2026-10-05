import { TriangleAlert } from "lucide-react";
import type { CSSProperties } from "react";
import type { CitaPanel } from "@/api/citas";
import { hora } from "@/lib/format";
import { cn } from "@/lib/utils";
import { descripcionCita, ESTADO_TEXTO, nombreCompleto } from "../textos";

/** Colores por estado, los mismos tonos de EstadoCitaBadge. */
const TONO: Record<CitaPanel["estado"], string> = {
  pendiente: "border-warning bg-warning-soft",
  confirmada: "border-primary bg-primary-soft",
  en_curso: "border-info bg-info-soft",
  completada: "border-done bg-done-soft",
  cancelada: "border-danger bg-danger-soft opacity-75",
  no_asistio: "border-subtle bg-track opacity-75",
  reprogramada: "border-subtle bg-track opacity-75",
};

/**
 * Una cita en el calendario. En la vista Semana la segunda línea dice el servicio y el
 * profesional; en la vista Día (ya por profesional), el cliente y el estado.
 */
export function CitaBloque({
  cita,
  vista,
  seleccionada,
  onAbrir,
  style,
}: {
  cita: CitaPanel;
  vista: "semana" | "dia";
  seleccionada: boolean;
  onAbrir: (cita: CitaPanel) => void;
  style: CSSProperties;
}) {
  const fuera = cita.fuera_de_disponibilidad;
  const segunda =
    vista === "semana"
      ? [cita.servicio.nombre, cita.empleado?.nombre].filter(Boolean).join(" · ")
      : [nombreCompleto(cita.cliente), fuera ? "fuera de disponibilidad" : ESTADO_TEXTO[cita.estado]].join(
          " · ",
        );
  const titulo =
    vista === "semana" ? cita.mascota.nombre : `${cita.mascota.nombre} · ${cita.servicio.nombre}`;

  return (
    <button
      type="button"
      onClick={() => onAbrir(cita)}
      aria-label={descripcionCita(cita)}
      aria-pressed={seleccionada}
      title={descripcionCita(cita)}
      style={style}
      className={cn(
        "absolute overflow-hidden rounded-[6px] border-l-[3px] px-1.5 py-1 text-left text-ink transition-shadow hover:shadow-card hover:brightness-[0.98] focus-visible:z-20",
        fuera ? "border border-l-[3px] border-warning bg-warning-soft" : TONO[cita.estado],
        seleccionada && "z-10 ring-2 ring-primary",
      )}
    >
      <span className="flex items-center gap-1 truncate text-label font-semibold">
        {fuera && <TriangleAlert className="size-3 shrink-0 text-warning-ink" aria-hidden />}
        <span className="tabular-nums">{hora(cita.hora_inicio)}</span>
        <span className="truncate">{titulo}</span>
      </span>
      <span className="block truncate text-[10px] leading-3 text-muted">{segunda}</span>
    </button>
  );
}
