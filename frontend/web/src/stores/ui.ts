import { create } from "zustand";
import type { CitaAfectada } from "@/api/negocios";

/** Estado de la interfaz que se abre desde fuera de las pantallas o que debe sobrevivir a una navegación. */
interface UiState {
  /** Mensaje del 403 por límite del plan; null = diálogo cerrado. */
  limitePlan: string | null;
  abrirLimitePlan: (mensaje: string) => void;
  cerrarLimitePlan: () => void;
  /**
   * Citas fuera de la disponibilidad tras un cambio ya guardado (horario de una sede,
   * desactivar a un miembro, su disponibilidad). Es global porque el guardado puede llevar a
   * otra pantalla (una semana sin horario retoma el asistente) y la API no vuelve a dar la
   * lista. `guardado` abre el título: "El horario se guardó". Con `textos`, el título y la
   * descripción son otros: citas que impiden un cambio (desactivar un servicio).
   */
  citasAfectadas: { citas: CitaAfectada[]; guardado: string; textos?: TextosCitas } | null;
  mostrarCitasAfectadas: (citas: CitaAfectada[], guardado: string, textos?: TextosCitas) => void;
  cerrarCitasAfectadas: () => void;
  /** Ya se resolvió (se reasignó, reprogramó o canceló): sale de la lista de citas afectadas. */
  quitarCitaAfectada: (idCita: number) => void;
  /**
   * Acción sobre una cita que se abre desde cualquier pantalla (detalle, panel lateral de la
   * agenda, citas afectadas de E2/D1/D3/D5/D6). La pinta AccionesCita en Raiz.
   */
  accionCita: { tipo: TipoAccionCita; idCita: number } | null;
  abrirAccionCita: (tipo: TipoAccionCita, idCita: number) => void;
  cerrarAccionCita: () => void;
}

export type TipoAccionCita = "cancelar" | "rechazar" | "reprogramar" | "reasignar" | "completar";

export interface TextosCitas {
  titulo: string;
  descripcion: string;
}

export const useUi = create<UiState>()((set) => ({
  limitePlan: null,
  abrirLimitePlan: (mensaje) => set({ limitePlan: mensaje }),
  cerrarLimitePlan: () => set({ limitePlan: null }),
  citasAfectadas: null,
  mostrarCitasAfectadas: (citas, guardado, textos) =>
    set({ citasAfectadas: citas.length > 0 ? { citas, guardado, textos } : null }),
  cerrarCitasAfectadas: () => set({ citasAfectadas: null }),
  quitarCitaAfectada: (idCita) =>
    set(({ citasAfectadas }) => {
      if (!citasAfectadas) return {};
      const citas = citasAfectadas.citas.filter((c) => c.id_cita !== idCita);
      return { citasAfectadas: citas.length > 0 ? { ...citasAfectadas, citas } : null };
    }),
  accionCita: null,
  abrirAccionCita: (tipo, idCita) => set({ accionCita: { tipo, idCita } }),
  cerrarAccionCita: () => set({ accionCita: null }),
}));
