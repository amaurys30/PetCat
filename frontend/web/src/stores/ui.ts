import { create } from "zustand";
import type { CitaAfectada } from "@/api/negocios";

/** Estado de la interfaz que se abre desde fuera de las pantallas o que debe sobrevivir a una navegación. */
interface UiState {
  /** Mensaje del 403 por límite del plan; null = diálogo cerrado. */
  limitePlan: string | null;
  abrirLimitePlan: (mensaje: string) => void;
  cerrarLimitePlan: () => void;
  /**
   * Citas que quedaron fuera de un horario recién guardado. Es global porque el guardado
   * puede llevar a otra pantalla (una semana sin horario retoma el asistente) y la API no
   * vuelve a dar la lista.
   */
  citasAfectadas: CitaAfectada[] | null;
  mostrarCitasAfectadas: (citas: CitaAfectada[]) => void;
  cerrarCitasAfectadas: () => void;
}

export const useUi = create<UiState>()((set) => ({
  limitePlan: null,
  abrirLimitePlan: (mensaje) => set({ limitePlan: mensaje }),
  cerrarLimitePlan: () => set({ limitePlan: null }),
  citasAfectadas: null,
  mostrarCitasAfectadas: (citas) => set({ citasAfectadas: citas.length > 0 ? citas : null }),
  cerrarCitasAfectadas: () => set({ citasAfectadas: null }),
}));
