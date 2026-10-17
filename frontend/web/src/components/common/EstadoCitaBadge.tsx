import type { components } from "@/api/schema";
import { Badge } from "@/components/ui/badge";

type Cita = components["schemas"]["Cita"];
export type EstadoCita = NonNullable<Cita["estado"]>;
type Cancelacion = Pick<NonNullable<Cita["cancelacion"]>, "por" | "tardia">;

const ESTADOS: Record<
  EstadoCita,
  { texto: string; tono: "warning" | "primary" | "info" | "done" | "danger" | "neutral" }
> = {
  pendiente: { texto: "Pendiente", tono: "warning" },
  confirmada: { texto: "Confirmada", tono: "primary" },
  en_curso: { texto: "En curso", tono: "info" },
  completada: { texto: "Completada", tono: "done" },
  cancelada: { texto: "Cancelada", tono: "danger" },
  no_asistio: { texto: "No asistió", tono: "neutral" },
  reprogramada: { texto: "Reprogramada", tono: "neutral" },
};

/** Único lugar donde se decide cómo se ve el estado de una cita. */
export function EstadoCitaBadge({
  estado,
  cancelacion,
  fueraDeDisponibilidad,
  plazo,
}: {
  estado: EstadoCita;
  cancelacion?: Cancelacion | null;
  fueraDeDisponibilidad?: boolean;
  /** Tiempo que queda para confirmar una pendiente ("2 h"): "Pendiente · 2 h". */
  plazo?: string | null;
}) {
  if (fueraDeDisponibilidad && (estado === "pendiente" || estado === "confirmada")) {
    return <Badge tono="warning">Fuera de disponibilidad</Badge>;
  }
  if (estado === "pendiente" && plazo) return <Badge tono="warning">Pendiente · {plazo}</Badge>;
  const { texto, tono } = ESTADOS[estado];
  if (estado === "cancelada" && cancelacion?.por === "sistema")
    return <Badge tono="danger">Cancelada · sistema</Badge>;
  if (estado === "cancelada" && cancelacion?.tardia) return <Badge tono="danger">Cancelada · tardía</Badge>;
  return <Badge tono={tono}>{texto}</Badge>;
}
