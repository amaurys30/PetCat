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
  /**
   * Se abrió sin red con datos guardados: hay sesión (refresh guardado) pero sin access token
   * ni perfil; las pantallas muestran la caché y no dejan escribir. `sinConexion` trae lo poco
   * que se guarda del usuario (nombre e id) para ese modo.
   */
  modoSinConexion: boolean;
  sinConexion: { id_usuario: number; nombre: string; guardado_en: number } | null;
  setAccessToken: (token: string) => void;
  iniciar: (datos: { accessToken: string; usuario: Usuario; requierePolitica?: boolean }) => void;
  setUsuario: (usuario: Usuario) => void;
  setRequierePolitica: (requiere: boolean) => void;
  setRecienRegistrado: (valor: boolean) => void;
  entrarSinConexion: (datos: { id_usuario: number; nombre: string; guardado_en: number }) => void;
  limpiar: () => void;
};

export const useSesion = create<Sesion>()((set) => ({
  accessToken: null,
  usuario: null,
  estado: "desconocida",
  requierePolitica: false,
  recienRegistrado: false,
  modoSinConexion: false,
  sinConexion: null,
  setAccessToken: (accessToken) => set({ accessToken, estado: "autenticada", modoSinConexion: false }),
  iniciar: ({ accessToken, usuario, requierePolitica }) =>
    set((s) => ({
      accessToken,
      usuario,
      estado: "autenticada",
      modoSinConexion: false,
      requierePolitica: requierePolitica ?? s.requierePolitica,
    })),
  setUsuario: (usuario) => set({ usuario }),
  setRequierePolitica: (requierePolitica) => set({ requierePolitica }),
  setRecienRegistrado: (recienRegistrado) => set({ recienRegistrado }),
  entrarSinConexion: (sinConexion) =>
    set({ estado: "autenticada", modoSinConexion: true, sinConexion, accessToken: null, usuario: null }),
  limpiar: () =>
    set({
      accessToken: null,
      usuario: null,
      estado: "anonima",
      requierePolitica: false,
      recienRegistrado: false,
      modoSinConexion: false,
      sinConexion: null,
    }),
}));

/** Id de la cuenta: del perfil o, sin conexión, de la sesión guardada. */
export const useIdUsuario = () =>
  useSesion((s) => s.usuario?.id_usuario ?? s.sinConexion?.id_usuario ?? null);

/** Nombre para el saludo: del perfil o, sin conexión, el guardado. */
export const useNombreUsuario = () => useSesion((s) => s.usuario?.nombre ?? s.sinConexion?.nombre ?? "");
