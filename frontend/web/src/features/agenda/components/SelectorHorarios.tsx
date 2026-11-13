import { cn } from "@/lib/utils";

const FRANJAS = [
  { nombre: "Madrugada", hasta: "06:00" },
  { nombre: "Mañana", hasta: "12:00" },
  { nombre: "Tarde", hasta: "18:00" },
  { nombre: "Noche", hasta: "24:00" },
] as const;

/** Franja de una hora "HH:MM": madrugada antes de las 6, mañana hasta las 12, tarde hasta las 18, noche después. */
const franjaDe = (hora: string) => FRANJAS.find((f) => hora < f.hasta)!.nombre;

/**
 * Horarios libres agrupados por madrugada (sedes de 24 horas), mañana, tarde y noche, con desplazamiento interno: con muchos
 * horarios (sedes de 24 horas) el diálogo no crece ni corta el título o los botones.
 */
export function SelectorHorarios({
  horarios,
  elegido,
  onElegir,
  className,
}: {
  horarios: readonly { hora_inicio: string }[];
  elegido: string | null;
  onElegir: (hora: string) => void;
  className?: string;
}) {
  const grupos = FRANJAS.map((f) => ({
    nombre: f.nombre,
    horas: horarios.filter((h) => franjaDe(h.hora_inicio) === f.nombre),
  })).filter((g) => g.horas.length > 0);

  return (
    <div
      role="radiogroup"
      aria-label="Horarios libres"
      className={cn("flex max-h-56 flex-col gap-3 overflow-y-auto rounded-control border p-3", className)}
    >
      {grupos.map((g) => (
        <div key={g.nombre} role="group" aria-label={g.nombre} className="flex flex-col gap-1.5">
          <p className="text-label font-semibold tracking-wide text-muted uppercase" aria-hidden>
            {g.nombre} · {g.horas.length}
          </p>
          <div className="flex flex-wrap gap-2">
            {g.horas.map((h) => (
              <button
                key={h.hora_inicio}
                type="button"
                role="radio"
                aria-checked={elegido === h.hora_inicio}
                onClick={() => onElegir(h.hora_inicio)}
                className={cn(
                  "h-8 rounded-control border px-3 text-body font-medium tabular-nums",
                  elegido === h.hora_inicio
                    ? "border-primary bg-primary text-white"
                    : "bg-white text-ink hover:bg-surface",
                )}
              >
                {h.hora_inicio}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
