import { useMutation, useQuery } from "@tanstack/react-query";
import * as authApi from "@/api/auth";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/stores/auth";
import type { RegistroValores } from "../schemas";

/** Las pantallas de acceso muestran sus errores en el formulario: sin aviso global. */
const meta = { avisarError: false } as const;

export function useLogin() {
  const entrar = useAuth((s) => s.entrar);
  return useMutation({
    meta,
    mutationFn: async ({
      email,
      password,
      recordar,
    }: {
      email: string;
      password: string;
      recordar: boolean;
    }) => {
      const sesion = await authApi.login({ email, password });
      return entrar(sesion, recordar);
    },
  });
}

/**
 * A7: crea la cuenta (dueño de negocio, canal panel_web) y entra con las mismas
 * credenciales, porque el registro no inicia sesión. Devuelve null si la cuenta se
 * creó pero el login falló: la pantalla manda al login.
 */
export function useRegistro() {
  const entrar = useAuth((s) => s.entrar);
  return useMutation({
    meta,
    mutationFn: async ({ telefono, ...valores }: RegistroValores) => {
      await authApi.register({
        ...valores,
        ...(telefono && { telefono }),
        acepta_politica_datos: true,
        tipo_usuario: "negocio",
        canal: "panel_web",
      });
      try {
        const sesion = await authApi.login({ email: valores.email, password: valores.password });
        return await entrar(sesion, true);
      } catch {
        return null;
      }
    },
  });
}

export function useRecuperarPassword() {
  return useMutation({ meta, mutationFn: (email: string) => authApi.forgotPassword(email) });
}

export function useRestablecerPassword() {
  return useMutation({
    meta,
    mutationFn: (body: authApi.ResetPasswordBody) => authApi.resetPassword(body),
  });
}

export function useAceptarPolitica() {
  const recargarUsuario = useAuth((s) => s.recargarUsuario);
  return useMutation({
    meta,
    mutationFn: async () => {
      await authApi.aceptarPolitica();
      return recargarUsuario();
    },
  });
}

/** Política vigente sin sesión (registro e invitaciones). Cambia muy poco. */
export function usePoliticaVigente() {
  return useQuery({
    queryKey: queryKeys.politica(),
    queryFn: authApi.getPoliticaVigente,
    staleTime: Infinity,
  });
}

export function useVerificarEmail() {
  return useMutation({ meta, mutationFn: (token: string) => authApi.verifyEmail(token) });
}

/** Con sesión. Los errores (409 ya verificado, 429, 503) los muestra la pantalla. */
export function useReenviarVerificacion() {
  return useMutation({ meta, mutationFn: authApi.resendVerification });
}

/** Sin sesión: respuesta neutra. */
export function usePedirVerificacion() {
  return useMutation({ meta, mutationFn: (email: string) => authApi.requestVerification(email) });
}
