import type { CitaPanel } from "@/api/citas";
import { encabezadoDia, tituloDia, tramosCerrados, ventanaVisible } from "@/lib/agenda";
import { abiertosDelDia, tramoDeCita } from "../calculos";
import type { SedeHorario } from "@/features/equipo/hooks/useDisponibilidad";
import { Calendario } from "./Calendario";

/**
 * B3 · Semana: una columna por día de lunes a domingo. Se ocultan los días en que ninguna
 * sede abre y no hay citas (el domingo de un negocio que no abre). Lo cerrado (horario
 * partido, "solo mañana") se sombrea con el horario de las sedes.
 */
export function VistaSemana({
  dias,
  citas,
  sedes,
  hoy,
  minutoActual,
  idSeleccionada,
  onAbrir,
}: {
  dias: string[];
  citas: CitaPanel[];
  sedes: readonly SedeHorario[];
  hoy: string;
  minutoActual: number;
  idSeleccionada?: number;
  onAbrir: (cita: CitaPanel) => void;
}) {
  const conAlgo = dias.filter((d) => abiertosDelDia(sedes, d).length > 0 || citas.some((c) => c.fecha === d));
  const visibles = conAlgo.length > 0 ? conAlgo : dias;
  const ventana = ventanaVisible([
    ...visibles.flatMap((d) => abiertosDelDia(sedes, d)),
    ...citas.map(tramoDeCita),
  ]);

  return (
    <Calendario
      vista="semana"
      ventana={ventana}
      columnas={visibles.map((d) => ({
        clave: d,
        nombre: tituloDia(d),
        encabezado: encabezadoDia(d),
        resaltada: d === hoy,
        cerrados: tramosCerrados(abiertosDelDia(sedes, d), ventana),
      }))}
      citas={citas.map((cita) => ({ cita, columna: cita.fecha }))}
      ahora={visibles.includes(hoy) ? { minuto: minutoActual, columnas: [hoy] } : null}
      idSeleccionada={idSeleccionada}
      onAbrir={onAbrir}
    />
  );
}
