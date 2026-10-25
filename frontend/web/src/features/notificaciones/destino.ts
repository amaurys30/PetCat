import { formatDistanceStrict } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlarmClock,
  Bell,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  ChartColumn,
  CreditCard,
  Star,
  type LucideIcon,
} from "lucide-react";
import type { Notificacion } from "@/api/notificaciones";
import { parseFechaHora } from "@/lib/format";

export type Destino =
  /** Ruta del panel que abre la notificación. */
  | { tipo: "ruta"; ruta: string; idNegocio: number }
  /** Es de un negocio al que el usuario ya no puede entrar. */
  | { tipo: "sin_acceso" }
  /** No tiene pantalla en el panel: solo se marca como leída. */
  | { tipo: "ninguno" };

const PLAN = new Set(["plan_limite_80", "plan_limite_alcanzado", "plan_prueba_por_vencer", "plan_vencido"]);

/**
 * A dónde lleva una notificación del panel: la cita en la agenda (en su semana, con el
 * detalle abierto), la reseña resaltada o la suscripción. `negocios`: ids de los negocios a
 * los que el usuario puede entrar (de `/auth/me`).
 */
export function destinoDe(n: Notificacion, negocios: number[]): Destino {
  const { datos } = n;
  const idNegocio = n.id_negocio ?? datos.id_negocio ?? null;
  let ruta: string | null = null;
  if (n.tipo.startsWith("cita_") && datos.id_cita) {
    const params = new URLSearchParams();
    if (datos.fecha) params.set("fecha", datos.fecha);
    params.set("cita", String(datos.id_cita));
    ruta = `agenda?${params}`;
  } else if (n.tipo === "resena_nueva" && datos.id_resena) {
    ruta = `resenas?resena=${datos.id_resena}`;
  } else if (PLAN.has(n.tipo)) {
    ruta = "suscripcion";
  }
  if (!ruta || idNegocio === null) return { tipo: "ninguno" };
  if (!negocios.includes(idNegocio)) return { tipo: "sin_acceso" };
  return { tipo: "ruta", ruta: `/n/${idNegocio}/${ruta}`, idNegocio };
}

const ICONOS: Partial<Record<Notificacion["tipo"], LucideIcon>> = {
  cita_nueva: CalendarPlus,
  cita_cancelada: CalendarX,
  cita_no_confirmada: CalendarX,
  cita_reprogramada: CalendarClock,
  cita_por_confirmar: AlarmClock,
  resena_nueva: Star,
  plan_limite_80: ChartColumn,
  plan_limite_alcanzado: ChartColumn,
  plan_prueba_por_vencer: CreditCard,
  plan_vencido: CreditCard,
};

export const iconoDe = (tipo: Notificacion["tipo"]): LucideIcon => ICONOS[tipo] ?? Bell;

/** "Hace 5 min", "Hace 3 h", "Hace 2 días"; "Ahora" en el primer minuto. */
export function haceCuanto(fecha: string, ahora: Date = new Date()): string {
  const momento = parseFechaHora(fecha);
  const segundos = (ahora.getTime() - momento.getTime()) / 1000;
  if (segundos < 60) return "Ahora";
  const texto = formatDistanceStrict(momento, ahora, { locale: es, roundingMethod: "floor" })
    .replace(/ minutos?/, " min")
    .replace(/ horas?/, " h");
  return `Hace ${texto}`;
}

/** Aviso del sistema operativo de una reserva nueva: genérico, sin datos del cliente ni de la mascota. */
export const AVISO_NAVEGADOR = {
  titulo: "Nueva reserva por confirmar",
  cuerpo: "Llegó una reserva desde la app. Ábrela en PetCat para confirmarla.",
};

/** ¿Merece un aviso del sistema operativo? Solo una reserva nueva que espera confirmación. */
export const esReservaPorConfirmar = (n: Notificacion) =>
  n.destino === "negocio" && n.tipo === "cita_nueva" && n.datos.por_confirmar === true;

/** "99+" cuando son muchas (campana y título de la pestaña). */
export const textoContador = (n: number) => (n > 99 ? "99+" : String(n));
