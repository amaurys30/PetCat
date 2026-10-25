import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { MotivoReporte, ResenaPanel } from "@/api/resenas";
import { fechaCorta, parseFecha, parseFechaHora } from "@/lib/format";

export const MOTIVOS_REPORTE: { valor: MotivoReporte; texto: string }[] = [
  { valor: "lenguaje_ofensivo", texto: "Lenguaje ofensivo" },
  { valor: "datos_personales", texto: "Datos personales" },
  { valor: "no_relacionada", texto: "No corresponde a una visita" },
  { valor: "spam", texto: "Spam o publicidad" },
  { valor: "otro", texto: "Otro motivo" },
];

export const textoMotivo = (motivo: MotivoReporte) =>
  MOTIVOS_REPORTE.find((m) => m.valor === motivo)?.texto ?? motivo;

export const ASPECTOS: { clave: keyof ResenaPanel["aspectos"]; texto: string }[] = [
  { clave: "atencion", texto: "Atención" },
  { clave: "puntualidad", texto: "Puntualidad" },
  { clave: "precio", texto: "Precio" },
  { clave: "instalaciones", texto: "Instalaciones" },
];

/** "Visita verificada · agosto 2026 · Consulta general" (mes y año, como en la app). */
export function textoVisita(cita: ResenaPanel["cita"]): string | null {
  if (!cita) return null;
  const mes = format(parseFecha(cita.fecha), "MMMM yyyy", { locale: es });
  return ["Visita verificada", mes, cita.servicio?.nombre].filter(Boolean).join(" · ");
}

/** "20 sep 2026" de una fecha con hora de la API. */
export const fechaDe = (valor: string) => fechaCorta(format(parseFechaHora(valor), "yyyy-MM-dd"));

export const MAX_RESPUESTA = 1000;
export const MAX_DETALLE_REPORTE = 500;
