import { Check } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { PASOS, type Paso } from "../schemas";

const NOMBRES: Record<Paso, string> = { negocio: "Negocio", sede: "Sede principal", horarios: "Horarios" };

/** Indicador de A6: Negocio — Sede principal — Horarios. */
export function PasosAsistente({ actual }: { actual: Paso }) {
  const indiceActual = PASOS.indexOf(actual);
  return (
    <ol className="mb-5 flex items-center gap-2" aria-label="Pasos para crear el negocio">
      {PASOS.map((paso, i) => {
        const hecho = i < indiceActual;
        const activo = i === indiceActual;
        return (
          <Fragment key={paso}>
            {i > 0 && <li aria-hidden className="h-px w-3 bg-subtle" />}
            <li className="flex items-center gap-2 text-body" aria-current={activo ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-label font-semibold",
                  hecho && "bg-primary text-white",
                  activo && "bg-primary-soft text-primary-dark",
                  !hecho && !activo && "bg-track text-muted",
                )}
              >
                {hecho ? <Check className="size-3.5" strokeWidth={3} aria-label="Hecho" /> : i + 1}
              </span>
              <span className={cn(activo ? "font-semibold text-ink" : "text-muted")}>{NOMBRES[paso]}</span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
