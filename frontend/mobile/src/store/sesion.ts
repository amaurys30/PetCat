import { create } from "zustand";

import type { Usuario } from "@/api/types";

// "desconocida": todavía no se intentó recuperar la sesión al abrir la app (llega en M1).
export type EstadoSesion = "desconocida" | "anonima" | "autenticada";

type Sesion = {
  /** Solo en memoria: nunca se persiste. */
  accessToken: string | null;
  usuario: Usuario | null;
  estado: EstadoSesion;
  setAccessToken: (token: string) => void;
  iniciar: (datos: { accessToken: string; usuario: Usuario }) => void;
  limpiar: () => void;
};

export const useSesion = create<Sesion>()((set) => ({
  accessToken: null,
  usuario: null,
  estado: "desconocida",
  setAccessToken: (accessToken) => set({ accessToken, estado: "autenticada" }),
  iniciar: ({ accessToken, usuario }) => set({ accessToken, usuario, estado: "autenticada" }),
  limpiar: () => set({ accessToken: null, usuario: null, estado: "anonima" }),
}));
