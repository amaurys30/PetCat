import { create } from "zustand";
import * as authApi from "@/api/auth";
import { toApiError } from "@/api/errors";
import {
  cerrarSesionLocal,
  hayRefresh,
  iniciarSesionLocal,
  pedirSesionAPestanas,
  renovarSesion,
  suscribirSesion,
} from "@/api/sesion";
import type { Me, Sesion } from "@/api/types";
import { queryClient } from "@/app/queryClient";

/**
 * Sesión del panel. Los tokens los maneja api/sesion.ts; aquí vive el estado que
 * pinta la interfaz: si hay sesión y el perfil (`GET /auth/me`) con sus negocios.
 */
type Estado = "iniciando" | "sin-conexion" | "anonimo" | "autenticado";

interface AuthState {
  estado: Estado;
  usuario: Me | null;
  /** Por qué terminó la última sesión: el login muestra "Tu sesión expiró". */
  salida: "expirada" | null;
  /** Al cargar la app: si hay refresh token (propio o de otra pestaña), renueva y trae el perfil. */
  iniciar: () => Promise<void>;
  entrar: (sesion: Sesion, recordar: boolean) => Promise<Me>;
  /**
   * Entra con una sesión nueva cerrando antes la que hubiera (aceptar una invitación con
   * otra cuenta abierta). Las demás pestañas cierran la anterior y toman la nueva.
   */
  reemplazar: (sesion: Sesion) => Promise<Me>;
  recargarUsuario: () => Promise<Me>;
  salir: () => Promise<void>;
}

const quedarAnonimo = (salida: AuthState["salida"]) => {
  queryClient.clear();
  useAuth.setState({ estado: "anonimo", usuario: null, salida });
};

export const useAuth = create<AuthState>()((set, get) => ({
  estado: "iniciando",
  usuario: null,
  salida: null,

  iniciar: async () => {
    set({ estado: "iniciando" });
    if (!hayRefresh()) await pedirSesionAPestanas();
    if (!hayRefresh()) {
      set({ estado: "anonimo", usuario: null });
      return;
    }
    try {
      await renovarSesion();
      const usuario = await authApi.getMe();
      set({ estado: "autenticado", usuario, salida: null });
    } catch (error) {
      if (toApiError(error).sinConexion) set({ estado: "sin-conexion" });
      else set({ estado: "anonimo", usuario: null });
    }
  },

  entrar: async (sesion, recordar) => {
    iniciarSesionLocal(sesion.access_token, sesion.refresh_token, recordar);
    const usuario = await authApi.getMe();
    set({ estado: "autenticado", usuario, salida: null });
    return usuario;
  },

  reemplazar: async (sesion) => {
    if (get().estado === "autenticado") {
      try {
        await authApi.logout();
      } catch {
        // La sesión anterior vence sola; lo importante es no seguir usándola.
      }
      cerrarSesionLocal();
    }
    return get().entrar(sesion, true);
  },

  recargarUsuario: async () => {
    const usuario = await authApi.getMe();
    set({ usuario });
    return usuario;
  },

  salir: async () => {
    try {
      await authApi.logout();
    } catch {
      // Aunque la API no responda, la sesión se cierra en el navegador.
    }
    cerrarSesionLocal();
    quedarAnonimo(null);
  },
}));

// Eventos de otras pestañas y de la renovación de tokens.
suscribirSesion((evento) => {
  const { estado } = useAuth.getState();
  if (evento.tipo === "perfil-externo") {
    if (estado === "autenticado")
      void useAuth
        .getState()
        .recargarUsuario()
        .catch(() => undefined);
    return;
  }
  if (evento.tipo === "cerrada") {
    if (estado === "autenticado") quedarAnonimo(evento.motivo === "expirada" ? "expirada" : null);
    return;
  }
  // Otra pestaña inició sesión: esta la toma sin pedir el login.
  if (estado === "anonimo") {
    authApi
      .getMe()
      .then((usuario) => useAuth.setState({ estado: "autenticado", usuario, salida: null }))
      .catch(() => undefined);
  }
});
