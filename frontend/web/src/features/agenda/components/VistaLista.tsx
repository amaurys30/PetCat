import { CalendarDays } from "lucide-react";
import type { CitaPanel } from "@/api/citas";
import { EstadoCitaBadge } from "@/components/common/EstadoCitaBadge";
import { Vacio } from "@/components/common/EstadoPantalla";
import { Card } from "@/components/ui/card";
import { encabezadoGrupo } from "@/lib/agenda";
import { hora } from "@/lib/format";
import { cn } from "@/lib/utils";
import { descripcionCita, nombreCompleto, nombreProfesional, plazoCorto } from "../textos";
import { agruparPorDia } from "../calculos";

/** B10 · Lista: las citas del rango agrupadas por día, con su estado. */
export function VistaLista({
  citas,
  hoy,
  ahora,
  vacio,
  idSeleccionada,
  onAbrir,
}: {
  citas: CitaPanel[];
  hoy: string;
  ahora: Date;
  vacio: string;
  idSeleccionada?: number;
  onAbrir: (cita: CitaPanel) => void;
}) {
  if (citas.length === 0) {
    return (
      <Card>
        <Vacio icono={CalendarDays} titulo={vacio} />
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden p-0">
      {agruparPorDia(citas, hoy).map(([fecha, delDia]) => (
        <section key={fecha} aria-label={encabezadoGrupo(fecha)}>
          <h3 className="border-b bg-track px-4 py-2 text-label font-semibold tracking-wide text-muted">
            {encabezadoGrupo(fecha)}
            {fecha === hoy && " · HOY"} · {delDia.length} {delDia.length === 1 ? "CITA" : "CITAS"}
          </h3>
          <ul>
            {delDia.map((c) => (
              <li key={c.id_cita} className="border-b last:border-b-0">
                <button
                  type="button"
                  onClick={() => onAbrir(c)}
                  aria-label={descripcionCita(c)}
                  aria-pressed={c.id_cita === idSeleccionada}
                  className={cn(
                    "grid w-full grid-cols-[72px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-3 px-4 py-2.5 text-left hover:bg-surface",
                    c.id_cita === idSeleccionada && "bg-selected",
                  )}
                >
                  <span className="text-card font-semibold text-ink tabular-nums">{hora(c.hora_inicio)}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{c.mascota.nombre}</span>
                    <span className="block truncate text-label text-muted">{c.servicio.nombre}</span>
                  </span>
                  <span className="truncate text-ink">{nombreCompleto(c.cliente)}</span>
                  <span className="truncate text-ink">{nombreProfesional(c)}</span>
                  <span>
                    <EstadoCitaBadge
                      estado={c.estado}
                      cancelacion={c.cancelacion}
                      fueraDeDisponibilidad={c.fuera_de_disponibilidad}
                      plazo={plazoCorto(c, ahora)}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Card>
  );
}
