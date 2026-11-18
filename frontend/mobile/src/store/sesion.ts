import { create } from "zustand";

import type { Usuario } from "@/api/types";

// "desconocida": todavía no se intentó recuperar la sesión al abrir la app.
export type EstadoSesion = "desconocida" | "anonima" | "autenticada";

type Sesion = {
  /** Solo en memoria: nunca se persiste. */
  accessToken: string | null;
  usuario: Usuario | null;
  estado: EstadoSesion;
  /** La cuenta no tiene autorización de datos para la versión vigente de la política. */
  requierePolitica: boolean;
  /** Recién creó la cuenta: al entrar va a confirmar el correo en lugar de a las pestañas. */
  recienRegistrado: boolean;
  setAccessToken: (token: string) => void;
  iniciar: (datos: { accessToken: string; usuario: Usuario; requierePolitica?: boolean }) => void;
  setUsuario: (usuario: Usuario) => void;
  setRequierePolitica: (requiere: boolean) => void;
  setRecienRegistrado: (valor: boolean) => void;
  limpiar: () => void;
};

export const useSesion = create<Sesion>()((set) => ({
  accessToken: null,
  usuario: null,
  estado: "desconocida",
  requierePolitica: false,
  recienRegistrado: false,
  setAccessToken: (accessToken) => set({ accessToken, estado: "autenticada" }),
  iniciar: ({ accessToken, usuario, requierePolitica }) =>
    set((s) => ({
      accessToken,
      usuario,
      estado: "autenticada",
      requierePolitica: requierePolitica ?? s.requierePolitica,
    })),
  setUsuario: (usuario) => set({ usuario }),
  setRequierePolitica: (requierePolitica) => set({ requierePolitica }),
  setRecienRegistrado: (recienRegistrado) => set({ recienRegistrado }),
  limpiar: () =>
    set({
      accessToken: null,
      usuario: null,
      estado: "anonima",
      requierePolitica: false,
      recienRegistrado: false,
    }),
}));
