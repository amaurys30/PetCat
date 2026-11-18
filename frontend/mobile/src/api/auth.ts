import { nombreDispositivo } from "@/lib/dispositivo";

import { api } from "./client";
import type { Body, DataGet, Respuesta, SesionApi } from "./types";

// Funciones de /auth y /politica-datos. Las que no llevan sesión van con `sinRenovar`:
// un 401 ahí es la respuesta (credenciales), no un token vencido.

export type Perfil = DataGet<"/auth/me">;
export type PoliticaDatos = DataGet<"/politica-datos">;
export type DatosRegistro = Omit<Body<"/auth/register", "post">, "canal" | "tipo_usuario">;

export async function postLogin(email: string, password: string): Promise<SesionApi> {
  const { data } = await api.post<Respuesta<SesionApi>>(
    "/auth/login",
    { email, password, dispositivo: nombreDispositivo() },
    { sinRenovar: true },
  );
  return data.data;
}

/** Perfil con un token concreto (recién recibido en el login, antes de guardarlo en la sesión). */
export async function getMe(accessToken?: string): Promise<Perfil> {
  const { data } = await api.get<Respuesta<Perfil>>(
    "/auth/me",
    accessToken ? { headers: { Authorization: `Bearer ${accessToken}` }, sinRenovar: true } : undefined,
  );
  return data.data;
}

export async function postRegistro(datos: DatosRegistro) {
  const { data } = await api.post<Respuesta<unknown>>(
    "/auth/register",
    { ...datos, tipo_usuario: "cliente", canal: "app" },
    { sinRenovar: true },
  );
  return data;
}

export async function postLogout(timeout = 5_000) {
  await api.post("/auth/logout", undefined, { sinRenovar: true, timeout });
}

export async function postOlvidePassword(email: string) {
  const { data } = await api.post<Respuesta<null>>("/auth/forgot-password", { email }, { sinRenovar: true });
  return data.message;
}

export async function postRestablecerConCodigo(email: string, codigo: string, password: string) {
  await api.post("/auth/reset-password/codigo", { email, codigo, password }, { sinRenovar: true });
}

export async function postVerificarCorreo(codigo: string) {
  await api.post("/auth/verify-email/codigo", { codigo });
}

export async function postReenviarVerificacion() {
  const { data } = await api.post<Respuesta<{ email: string }>>("/auth/resend-verification");
  return data.message;
}

export async function postAceptarPolitica() {
  await api.post("/auth/politica-datos/aceptar", { acepta_politica_datos: true });
}

export async function getPoliticaDatos(): Promise<PoliticaDatos> {
  const { data } = await api.get<Respuesta<PoliticaDatos>>("/politica-datos", { sinRenovar: true });
  return data.data;
}
