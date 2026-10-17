import type { CitaPanel } from "@/api/citas";
import { fechaHoraCita } from "@/lib/agenda";
import { nombreCompleto } from "../../textos";

/** La cita en una tarjeta: "Luna · Vacuna antirrábica", cuándo, cliente y profesional. */
export function ResumenCita({ cita, detalle }: { cita: CitaPanel; detalle?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-control bg-surface p-3">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-done-soft text-card font-bold text-done"
        aria-hidden
      >
        {cita.mascota.nombre.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-card font-semibold text-ink">
          {cita.mascota.nombre} · {cita.servicio.nombre}
        </span>
        <span className="block truncate text-label text-muted">
          {detalle ??
            [
              fechaHoraCita(cita.fecha, cita.hora_inicio),
              nombreCompleto(cita.cliente),
              cita.empleado && nombreCompleto(cita.empleado),
            ]
              .filter(Boolean)
              .join(" · ")}
        </span>
      </span>
    </div>
  );
}
