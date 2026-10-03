import { useMutation } from "@tanstack/react-query";
import * as authApi from "@/api/auth";
import { useAuth } from "@/stores/auth";

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
