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
   * lista. `guardado` abre el título: "El horario se guardó".
   */
  citasAfectadas: { citas: CitaAfectada[]; guardado: string } | null;
  mostrarCitasAfectadas: (citas: CitaAfectada[], guardado: string) => void;
  cerrarCitasAfectadas: () => void;
}

export const useUi = create<UiState>()((set) => ({
  limitePlan: null,
  abrirLimitePlan: (mensaje) => set({ limitePlan: mensaje }),
  cerrarLimitePlan: () => set({ limitePlan: null }),
  citasAfectadas: null,
  mostrarCitasAfectadas: (citas, guardado) =>
    set({ citasAfectadas: citas.length > 0 ? { citas, guardado } : null }),
  cerrarCitasAfectadas: () => set({ citasAfectadas: null }),
}));
