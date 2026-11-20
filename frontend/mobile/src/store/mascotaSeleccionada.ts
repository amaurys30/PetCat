import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Mascota elegida en Inicio, recordada entre aperturas. Solo guarda ids: el resto llega de la
 * API (o de la caché). Si es de otra cuenta, se ignora; cerrar sesión la borra.
 */
type Seleccion = {
  id_usuario: number | null;
  id_mascota: number | null;
  seleccionar: (id_usuario: number, id_mascota: number) => void;
  limpiar: () => void;
};

export const CLAVE_SELECCION = "petcat.mascota";

export const useMascotaSeleccionada = create<Seleccion>()(
  persist(
    (set) => ({
      id_usuario: null,
      id_mascota: null,
      seleccionar: (id_usuario, id_mascota) => set({ id_usuario, id_mascota }),
      limpiar: () => set({ id_usuario: null, id_mascota: null }),
    }),
    {
      name: CLAVE_SELECCION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ id_usuario, id_mascota }) => ({ id_usuario, id_mascota }),
    },
  ),
);
