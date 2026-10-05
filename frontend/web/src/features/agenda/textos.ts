import type { CitaPanel } from "@/api/citas";
import { hora, tiempoCorto } from "@/lib/format";

export const nombreCompleto = (p: { nombre: string; apellido: string }) => `${p.nombre} ${p.apellido}`;

export const nombreProfesional = (c: Pick<CitaPanel, "empleado">) =>
  c.empleado ? nombreCompleto(c.empleado) : "Sin profesional";

/**
 * Por qué una cita quedó fuera de la disponibilidad: "Paula está de vacaciones",
 * "Paula tiene un bloqueo: Cita médica personal", "Fuera del horario de Paula". El texto
 * libre del motivo solo llega con configuracion.ver (para los demás, la API lo envía en null).
 */
export function textoMotivoFuera(c: Pick<CitaPanel, "motivo_fuera" | "empleado">): string {
  const quien = c.empleado?.nombre ?? "el profesional";
  const m = c.motivo_fuera;
  if (!m) return "Fuera de la disponibilidad";
  const detalle = m.motivo ? `: ${m.motivo}` : "";
  if (m.tipo === "vacacion") return `${quien} está de vacaciones${detalle}`;
  if (m.tipo === "bloqueo") return `${quien} tiene un bloqueo${detalle}`;
  return `Fuera del horario de ${quien}`;
}

/** "2 h" que quedan para confirmar una pendiente; null si no tiene plazo o ya venció. */
export const plazoCorto = (c: Pick<CitaPanel, "confirmar_antes_de">, ahora: Date) =>
  c.confirmar_antes_de ? tiempoCorto(c.confirmar_antes_de, ahora) : null;

/** "Se cancela sola en 2 h", "Se cancela en breve" (el plazo pasó) o null sin plazo. */
export function textoPlazo(c: Pick<CitaPanel, "confirmar_antes_de">, ahora: Date): string | null {
  if (!c.confirmar_antes_de) return null;
  const falta = plazoCorto(c, ahora);
  return falta ? `Se cancela sola en ${falta}` : "Se cancela en breve";
}

/** Estado en minúsculas, para frases ("Laura Gómez · por confirmar"). */
export const ESTADO_TEXTO: Record<CitaPanel["estado"], string> = {
  pendiente: "por confirmar",
  confirmada: "confirmada",
  en_curso: "en curso",
  completada: "completada",
  cancelada: "cancelada",
  no_asistio: "no asistió",
  reprogramada: "reprogramada",
};

/** Descripción completa de una cita, para lectores de pantalla y el título al pasar el cursor. */
export function descripcionCita(c: CitaPanel): string {
  return [
    `${hora(c.hora_inicio)}–${hora(c.hora_fin)}`,
    c.mascota.nombre,
    c.servicio.nombre,
    nombreCompleto(c.cliente),
    c.empleado ? nombreCompleto(c.empleado) : "sin profesional",
    ESTADO_TEXTO[c.estado],
    ...(c.fuera_de_disponibilidad ? [textoMotivoFuera(c)] : []),
  ].join(" · ");
}

export const ORIGEN: Record<CitaPanel["origen"], string> = {
  app_movil: "App móvil",
  panel_web: "Panel web",
  whatsapp: "WhatsApp",
  presencial: "Presencial",
  telefono: "Teléfono",
};
