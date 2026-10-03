import { create } from "zustand";

/**
 * Negocio activo. La fuente de verdad es la URL (/n/:idNegocio/...): NegocioLayout lo
 * copia aquí para lo que vive fuera de las rutas del panel (diálogos globales).
 */
interface NegocioState {
  idNegocio: number | null;
  setIdNegocio: (id: number | null) => void;
}

export const useNegocioStore = create<NegocioState>()((set) => ({
  idNegocio: null,
  setIdNegocio: (idNegocio) => set({ idNegocio }),
}));
