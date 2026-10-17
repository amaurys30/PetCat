import type { ResumenSalud, TipoHistorial, Vacuna } from "@/api/salud";
import { diasEntre } from "@/lib/agenda";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { hoyISO, parseFecha } from "@/lib/format";

export const TIPO_HISTORIAL: Record<TipoHistorial, string> = {
  consulta_general: "Consulta",
  cirugia: "Cirugía",
  vacunacion: "Vacunación",
  examen_laboratorio: "Examen de laboratorio",
  radiografia: "Radiografía",
  ecografia: "Ecografía",
  hospitalizacion: "Hospitalización",
  urgencia: "Urgencia",
  desparasitacion: "Desparasitación",
  otro: "Otro",
};

export const textoTipo = (tipo: string) => TIPO_HISTORIAL[tipo as TipoHistorial] ?? tipo;

export const ESTADO_VACUNA: Record<
  Vacuna["estado"],
  { texto: string; tono: "danger" | "warning" | "primary" | "neutral" }
> = {
  vencido: { texto: "Vencida", tono: "danger" },
  proximo: { texto: "Próxima", tono: "warning" },
  al_dia: { texto: "Al día", tono: "primary" },
  no_aplica: { texto: "No aplica", tono: "neutral" },
};

export const SEXO: Record<ResumenSalud["mascota"]["sexo"], string | null> = {
  macho: "Macho",
  hembra: "Hembra",
  desconocido: null,
};

/** "hoy", "ayer", "hace 12 días", "hace 3 meses". */
export function haceCuanto(fecha: string, hoy = hoyISO()): string {
  const dias = diasEntre(fecha, hoy);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 60) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses < 24 ? `hace ${meses} meses` : `hace ${Math.floor(dias / 365)} años`;
}

/** "985000000000421" -> "985…421" (el número completo queda en el título). */
export const microchipCorto = (m: string) => (m.length > 8 ? `${m.slice(0, 3)}…${m.slice(-3)}` : m);

/** "2025-09-13" -> "13 sep 25" (tablas angostas). */
export const fechaCompacta = (fecha: string) =>
  format(parseFecha(fecha), "d MMM yy", { locale: es }).replace(".", "");
