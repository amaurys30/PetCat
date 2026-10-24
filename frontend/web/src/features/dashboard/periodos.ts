import { addDays, differenceInCalendarDays, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { parseFecha } from "@/lib/format";

/** Periodos del filtro del dashboard. "30" es el de la API cuando no se envía rango. */
export type Periodo = "7" | "30" | "90" | "mes" | "mes_anterior" | "12m" | "personalizado";

export const PERIODO_POR_DEFECTO: Periodo = "30";

export const PERIODOS: { valor: Periodo; texto: string }[] = [
  { valor: "7", texto: "Últimos 7 días" },
  { valor: "30", texto: "Últimos 30 días" },
  { valor: "90", texto: "Últimos 90 días" },
  { valor: "mes", texto: "Este mes" },
  { valor: "mes_anterior", texto: "Mes anterior" },
  { valor: "12m", texto: "Últimos 12 meses" },
  { valor: "personalizado", texto: "Personalizado" },
];

/** Periodos que pasan del rango del plan Gratuito (92 días). */
export const SOLO_AVANZADO: Periodo[] = ["12m"];

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const restar = (fecha: string, dias: number) => iso(addDays(parseFecha(fecha), -dias));

export const esPeriodo = (valor: string | null): valor is Periodo => PERIODOS.some((p) => p.valor === valor);

/** Rango de un periodo hasta `hoy` (Bogotá). Personalizado usa `desde` y `hasta` de la URL. */
export function rangoDe(
  periodo: Periodo,
  hoy: string,
  personalizado?: { desde?: string | null; hasta?: string | null },
): { desde: string; hasta: string } {
  switch (periodo) {
    case "7":
      return { desde: restar(hoy, 6), hasta: hoy };
    case "90":
      return { desde: restar(hoy, 89), hasta: hoy };
    case "mes":
      return { desde: iso(startOfMonth(parseFecha(hoy))), hasta: hoy };
    case "mes_anterior": {
      const anterior = subMonths(parseFecha(hoy), 1);
      return { desde: iso(startOfMonth(anterior)), hasta: iso(endOfMonth(anterior)) };
    }
    // 366 días, el máximo con estadísticas avanzadas.
    case "12m":
      return { desde: restar(hoy, 365), hasta: hoy };
    case "personalizado":
      if (personalizado?.desde && personalizado.hasta && personalizado.desde <= personalizado.hasta) {
        return { desde: personalizado.desde, hasta: personalizado.hasta };
      }
      return rangoDe(PERIODO_POR_DEFECTO, hoy);
    default:
      return { desde: restar(hoy, 29), hasta: hoy };
  }
}

export const diasDelRango = ({ desde, hasta }: { desde: string; hasta: string }) =>
  differenceInCalendarDays(parseFecha(hasta), parseFecha(desde)) + 1;

const corto = (fecha: string) => format(parseFecha(fecha), "d MMM", { locale: es }).replace(".", "");

/** "27 ago – 25 sep" (con el año si el rango cruza de año). */
export function textoRango({ desde, hasta }: { desde: string; hasta: string }): string {
  if (desde === hasta) return corto(desde);
  const otroAno = desde.slice(0, 4) !== hasta.slice(0, 4);
  return otroAno
    ? `${corto(desde)} ${desde.slice(0, 4)} – ${corto(hasta)} ${hasta.slice(0, 4)}`
    : `${corto(desde)} – ${corto(hasta)}`;
}
