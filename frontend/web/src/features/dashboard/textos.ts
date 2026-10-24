import { format } from "date-fns";
import { es } from "date-fns/locale";
import { parseFecha } from "@/lib/format";

const decimal = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

/** 8.3 -> "8,3 %"; null -> "—". */
export const porcentaje = (valor: number | null) => (valor === null ? "—" : `${decimal.format(valor)} %`);

/** 1100000 -> "$1,1 M"; 480000 -> "$480 mil"; 900 -> "$900". Para listas con poco espacio. */
export function dineroCorto(valor: number): string {
  if (valor >= 1_000_000) return `$${decimal.format(valor / 1_000_000)} M`;
  if (valor >= 1_000) return `$${Math.round(valor / 1_000)} mil`;
  return `$${Math.round(valor)}`;
}

export interface Variacion {
  texto: string;
  /** Sube, baja o igual, para la flecha. */
  sentido: "sube" | "baja" | "igual";
  /** Si el cambio es bueno para el negocio (más ingresos, menos inasistencias). */
  bueno: boolean;
}

/** "12 % vs periodo anterior"; null si no hay con qué comparar. */
export function variacionPct(valor: number | null, { menosEsMejor = false } = {}): Variacion | null {
  if (valor === null) return null;
  const sentido = valor > 0 ? "sube" : valor < 0 ? "baja" : "igual";
  return {
    texto: `${decimal.format(Math.abs(valor))} % vs periodo anterior`,
    sentido,
    bueno: sentido === "igual" || (sentido === "sube") !== menosEsMejor,
  };
}

/** Diferencia de una tasa en puntos porcentuales: "2 pts". Menos inasistencia es mejor. */
export function variacionPuntos(actual: number | null, anterior: number | null): Variacion | null {
  if (actual === null || anterior === null) return null;
  const diferencia = Math.round((actual - anterior) * 10) / 10;
  const sentido = diferencia > 0 ? "sube" : diferencia < 0 ? "baja" : "igual";
  return {
    texto: `${decimal.format(Math.abs(diferencia))} ${Math.abs(diferencia) === 1 ? "pt" : "pts"} vs periodo anterior`,
    sentido,
    bueno: sentido !== "sube",
  };
}

/** Tasa de inasistencia de una fila de desempeño (inasistencias sobre las que debían llegar). */
export function tasaInasistencia({
  completadas,
  inasistencias,
}: {
  completadas: number;
  inasistencias: number;
}) {
  const base = completadas + inasistencias;
  return base > 0 ? Math.round((inasistencias / base) * 1000) / 10 : null;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** { dia_semana: 2, hora: 9 } -> "Martes · 9:00–10:00" (0 = domingo, como la API). */
export function franjaHoraria({ dia_semana, hora }: { dia_semana: number; hora: number }): string {
  const dia = DIAS[dia_semana] ?? "";
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} · ${hora}:00–${hora + 1}:00`;
}

/** Etiqueta de un punto de la tendencia según la agrupación. */
export function etiquetaPunto(inicio: string, agrupacion: "dia" | "semana" | "mes"): string {
  const fecha = parseFecha(inicio);
  if (agrupacion === "mes") return format(fecha, "MMM", { locale: es }).replace(".", "");
  return format(fecha, "d MMM", { locale: es }).replace(".", "");
}

/** Texto largo del punto para el tooltip y la tabla: "Semana del 29 sep". */
export function tituloPunto(inicio: string, agrupacion: "dia" | "semana" | "mes"): string {
  const fecha = parseFecha(inicio);
  if (agrupacion === "mes")
    return format(fecha, "MMMM 'de' yyyy", { locale: es }).replace(/^./, (l) => l.toUpperCase());
  if (agrupacion === "semana") return `Semana del ${format(fecha, "d 'de' MMMM", { locale: es })}`;
  return format(fecha, "EEEE d 'de' MMMM", { locale: es }).replace(/^./, (l) => l.toUpperCase());
}

export const AGRUPACION_TEXTO = { dia: "día", semana: "semana", mes: "mes" } as const;

export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
