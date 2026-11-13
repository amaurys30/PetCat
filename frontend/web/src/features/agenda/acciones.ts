import type { CambioHistorial, CitaPanel } from "@/api/citas";
import { dinero, hoyISO, yaLlego } from "@/lib/format";

export interface Acciones {
  confirmar: boolean;
  rechazar: boolean;
  cancelar: boolean;
  reprogramar: boolean;
  reasignar: boolean;
  /** Confirmada → en curso (desde el día de la cita). */
  iniciar: boolean;
  /** Desde en curso, o desde confirmada si ya empezó (las dos llamadas seguidas). */
  completar: boolean;
  /** Desde la hora de inicio. */
  noAsistio: boolean;
  /** No asistió → en curso, solo el mismo día (el cliente llegó tarde). */
  llegoTarde: boolean;
}

/**
 * Qué se puede hacer con la cita según su estado, la hora (Bogotá) y los permisos, con las
 * mismas reglas que la API (TRANSICIONES de cita.cambios.js). La API decide igual. Reasignar a
 * otro profesional exige además citas.ver_todas (`verTodas`).
 */
export function accionesDe(
  cita: Pick<CitaPanel, "estado" | "fecha" | "hora_inicio">,
  { editar, cancelar, verTodas = true }: { editar: boolean; cancelar: boolean; verTodas?: boolean },
  ahora: Date = new Date(),
): Acciones {
  const hoy = hoyISO(ahora);
  const empezo = yaLlego(`${cita.fecha} ${cita.hora_inicio}`, ahora);
  const pendiente = cita.estado === "pendiente";
  const confirmada = cita.estado === "confirmada";
  const activa = pendiente || confirmada;
  return {
    confirmar: editar && pendiente,
    rechazar: cancelar && pendiente,
    cancelar: cancelar && confirmada,
    reprogramar: editar && activa,
    reasignar: editar && verTodas && activa,
    iniciar: editar && confirmada && cita.fecha <= hoy,
    completar: editar && (cita.estado === "en_curso" || (confirmada && empezo)),
    noAsistio: editar && confirmada && empezo,
    llegoTarde: editar && cita.estado === "no_asistio" && cita.fecha === hoy,
  };
}

const ESTADO_HISTORIAL: Record<string, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  en_curso: "En curso",
  completada: "Completada",
  cancelada: "Cancelada",
  no_asistio: "No asistió",
  reprogramada: "Reprogramada",
};

const estadoTexto = (valor: string | null) => (valor ? (ESTADO_HISTORIAL[valor] ?? valor) : "—");

const DESDE_ORIGEN: Record<CitaPanel["origen"], string> = {
  app_movil: "desde la app",
  panel_web: "en el panel",
  whatsapp: "por WhatsApp",
  presencial: "en persona",
  telefono: "por teléfono",
};

/** Título de un cambio del historial: "Creada desde la app · pendiente", "Confirmada"... */
export function tituloCambio(c: CambioHistorial, origen: CitaPanel["origen"]): string {
  if (c.campo === "estado") {
    if (c.valor_anterior === null)
      return `Creada ${DESDE_ORIGEN[origen]} · ${estadoTexto(c.valor_nuevo).toLowerCase()}`;
    if (c.valor_anterior === "no_asistio" && c.valor_nuevo === "en_curso") return "Llegó tarde: en curso";
    return estadoTexto(c.valor_nuevo);
  }
  if (c.campo === "empleado")
    return `Profesional: ${c.valor_anterior ?? "sin asignar"} → ${c.valor_nuevo ?? "sin asignar"}`;
  if (c.campo === "precio_final")
    return `Precio final: ${c.valor_nuevo === null ? "sin precio" : dinero(Number(c.valor_nuevo))}`;
  if (c.campo === "prioridad") return `Prioridad: ${c.valor_nuevo ?? "normal"}`;
  return "Notas internas editadas";
}

/** Quién hizo el cambio: el nombre del personal, "Cliente" o "Automático" (el sistema). */
export function autorCambio(c: CambioHistorial): string {
  if (c.realizado_por === "sistema") return "Automático";
  const persona = c.empleado ?? c.usuario;
  if (persona) return `${persona.nombre} ${persona.apellido}`;
  return c.realizado_por === "dueno" ? "Cliente" : "Negocio";
}

/** "Reservada desde la app", "Agendada por teléfono", "Agendada en el panel"... */
export const textoOrigen = (origen: CitaPanel["origen"]) =>
  origen === "app_movil" ? "Reservada desde la app" : `Agendada ${DESDE_ORIGEN[origen]}`;
