import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "./client";
import type { Body, DataGet, Me, Sesion, Usuario } from "./types";

export type LoginBody = Body<"/auth/login", "post">;
export type RegisterBody = Body<"/auth/register", "post">;
export type ResetPasswordBody = Body<"/auth/reset-password", "post">;
export type PoliticaDatos = DataGet<"/politica-datos">;

/** Sin renovación automática: un 401 aquí es "credenciales inválidas", no sesión vencida. */
export const login = (body: LoginBody) => apiPost<Sesion>("/auth/login", body, { sinRenovar: true });

/** No inicia sesión: después se llama a login. */
export const register = (body: RegisterBody) =>
  apiPost<Usuario>("/auth/register", body, { sinRenovar: true });

export const logout = () => apiPost<null>("/auth/logout", undefined, { sinRenovar: true });

export const getMe = () => apiGet<Me>("/auth/me");

/** Pública: para enlazar la política antes de que haya sesión. */
export const getPoliticaVigente = () =>
  apiGet<PoliticaDatos>("/politica-datos", undefined, { sinRenovar: true });

export const forgotPassword = (email: string) =>
  apiPost<null>("/auth/forgot-password", { email }, { sinRenovar: true });

export const resetPassword = (body: ResetPasswordBody) =>
  apiPost<null>("/auth/reset-password", body, { sinRenovar: true });

export const aceptarPolitica = () =>
  apiPost<unknown>("/auth/politica-datos/aceptar", { acepta_politica_datos: true });

/** El token sirve una sola vez: un segundo intento da 400. */
export const verifyEmail = (token: string) =>
  apiGet<null>(`/auth/verify-email/${token}`, undefined, { sinRenovar: true });

/** Con sesión: 409 si ya está verificado, 429 antes de un minuto, 503 si el correo falló. */
export const resendVerification = () => apiPost<{ email: string }>("/auth/resend-verification");

/** Sin sesión: la respuesta es la misma exista o no la cuenta. */
export const requestVerification = (email: string) =>
  apiPost<null>("/auth/request-verification", { email }, { sinRenovar: true });

export type ActualizarPerfilBody = Body<"/auth/me", "patch">;
export type CambiarPasswordBody = Body<"/auth/change-password", "post">;

/** Nombre, apellido, teléfono, idioma y notificaciones. El correo no se cambia aquí. */
export const actualizarPerfil = (body: ActualizarPerfilBody) => apiPatch<unknown>("/auth/me", body);

/** multipart con el archivo en `foto`. */
export const subirFoto = (archivo: File, onProgreso?: (porcentaje: number) => void) => {
  const datos = new FormData();
  datos.append("foto", archivo);
  return apiPut<unknown>("/auth/me/foto", datos, {
    onUploadProgress: (e) => e.total && onProgreso?.(Math.round((e.loaded / e.total) * 100)),
  });
};

export const eliminarFoto = () => apiDelete<unknown>("/auth/me/foto");

/** Cierra las demás sesiones del usuario (esta sigue). 422 si la actual no es correcta. */
export const cambiarPassword = (body: CambiarPasswordBody) => apiPost<null>("/auth/change-password", body);
