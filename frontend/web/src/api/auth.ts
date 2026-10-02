import { apiGet, apiPost } from "./client";
import type { Body, Me, Sesion } from "./types";

export type LoginBody = Body<"/auth/login", "post">;
export type ResetPasswordBody = Body<"/auth/reset-password", "post">;

/** Sin renovación automática: un 401 aquí es "credenciales inválidas", no sesión vencida. */
export const login = (body: LoginBody) => apiPost<Sesion>("/auth/login", body, { sinRenovar: true });

export const logout = () => apiPost<null>("/auth/logout", undefined, { sinRenovar: true });

export const getMe = () => apiGet<Me>("/auth/me");

export const forgotPassword = (email: string) =>
  apiPost<null>("/auth/forgot-password", { email }, { sinRenovar: true });

export const resetPassword = (body: ResetPasswordBody) =>
  apiPost<null>("/auth/reset-password", body, { sinRenovar: true });

export const aceptarPolitica = () =>
  apiPost<unknown>("/auth/politica-datos/aceptar", { acepta_politica_datos: true });
