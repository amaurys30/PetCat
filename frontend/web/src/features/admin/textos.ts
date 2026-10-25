import type { EstadoPlanAdmin, NegocioAdmin, SuscripcionHistorial } from "@/api/admin";
import { fechaCorta } from "@/lib/format";
import { TIPOS_NEGOCIO } from "@/features/negocios/textos";

export const SIN_VENCIMIENTO = "9999-12-31";

export const ESTADO_PLAN: Record<EstadoPlanAdmin, { texto: string; tono: "primary" | "info" | "danger" }> = {
  activa: { texto: "Activa", tono: "primary" },
  en_prueba: { texto: "En prueba", tono: "info" },
  vencida: { texto: "Vencida", tono: "danger" },
};

export const ESTADO_HISTORIAL: Record<SuscripcionHistorial["estado"], string> = {
  activa: "Activa",
  en_prueba: "En prueba",
  vencida: "Vencida",
  cancelada: "Cerrada",
  pendiente: "Pendiente",
};

/** "Veterinaria" (o el tipo tal cual si no está en la lista). */
export const textoTipo = (tipo: string) => (TIPOS_NEGOCIO as Record<string, string>)[tipo] ?? tipo;

/** Vencimiento de la suscripción vigente: el fin de la prueba, la fecha de fin o "—" sin vencimiento. */
export function textoVence(n: NegocioAdmin): string {
  const s = n.suscripcion;
  if (!s) return "—";
  if (s.estado === "en_prueba" && s.fecha_prueba_fin) return fechaCorta(s.fecha_prueba_fin);
  return s.fecha_fin === SIN_VENCIMIENTO ? "—" : fechaCorta(s.fecha_fin);
}

/** "26 / 30" o "114" (ilimitado). */
export const textoCitasMes = ({ citas_mes: c }: NegocioAdmin) =>
  c.maximo === -1 ? String(c.usadas) : `${c.usadas} / ${c.maximo}`;

/** "Ana Admin (admin)", "Laura Gómez (propietario)" o "Automática". */
export function textoRegistro(s: SuscripcionHistorial): string {
  const r = s.registrada_por;
  if (!r) return "Automática";
  return `${r.nombre} ${r.apellido} · ${r.es_admin ? "super admin" : "propietario"}`;
}
