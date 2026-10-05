import type { CitaPanel } from "@/api/citas";
import type { SedeHorario } from "@/features/equipo/hooks/useDisponibilidad";
import { aMinutos, diaSemana, type Tramo } from "@/lib/agenda";

/** Rangos en que abre alguna de las sedes ese día (la unión, si se ven todas). */
export function abiertosDelDia(sedes: readonly SedeHorario[], fecha: string): Tramo[] {
  const dia = diaSemana(fecha);
  return sedes.flatMap((s) =>
    s.horarios
      .filter((h) => h.dia_semana === dia)
      .map((h) => ({ inicio: aMinutos(h.hora_apertura), fin: aMinutos(h.hora_cierre) })),
  );
}

export const tramoDeCita = (c: CitaPanel): Tramo => ({
  inicio: aMinutos(c.hora_inicio),
  fin: aMinutos(c.hora_fin),
});

/**
 * Días de la vista Lista: hoy y los siguientes primero (lo que hay que atender), después
 * los pasados del más reciente hacia atrás. Dentro de cada día, por hora.
 */
export function agruparPorDia(citas: readonly CitaPanel[], hoy: string): [string, CitaPanel[]][] {
  const grupos = new Map<string, CitaPanel[]>();
  for (const c of citas) grupos.set(c.fecha, [...(grupos.get(c.fecha) ?? []), c]);
  const fechas = [...grupos.keys()];
  const proximas = fechas.filter((f) => f >= hoy).sort();
  const pasadas = fechas
    .filter((f) => f < hoy)
    .sort()
    .reverse();
  return [...proximas, ...pasadas].map((f) => [
    f,
    grupos.get(f)!.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)),
  ]);
}
