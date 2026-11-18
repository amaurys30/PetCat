import { create, isAxiosError, type AxiosError, type InternalAxiosRequestConfig } from "axios";

import { env } from "@/lib/env";
import { useSesion } from "@/store/sesion";

import { toApiError } from "./errors";
import { renovacionEnCurso, renovarSesion } from "./sesion";

declare module "axios" {
  interface AxiosRequestConfig {
    /** No intentar renovar la sesión ante un 401 (login, registro, recuperar contraseña). */
    sinRenovar?: boolean;
    /** Interno: la petición ya se reintentó una vez tras renovar. */
    _reintentada?: boolean;
  }
}

// Cliente único de la API. Las pantallas no lo usan directo: cada módulo expone funciones en
// src/api/<modulo>.ts y hooks en features/<modulo>/. Todo error sale como ApiError.
export const api = create({
  baseURL: env.apiUrl,
  timeout: 15_000,
  headers: { Accept: "application/json" },
});

api.interceptors.request.use(async (config) => {
  if (!config.sinRenovar) {
    // Si otra petición está renovando, esperar para salir ya con el token nuevo.
    const renovando = renovacionEnCurso();
    if (renovando) await renovando.catch(() => undefined);
  }
  const token = useSesion.getState().accessToken;
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (respuesta) => respuesta,
  async (error: unknown) => {
    const config = isAxiosError(error) ? (error as AxiosError).config : undefined;
    const es401 = isAxiosError(error) && error.response?.status === 401;
    if (!es401 || !config || config.sinRenovar || config._reintentada) throw toApiError(error);

    const reintento: InternalAxiosRequestConfig = { ...config, _reintentada: true };
    const usado = config.headers.Authorization;
    const actual = useSesion.getState().accessToken;

    // Si otra petición ya renovó mientras esta viajaba, basta con reintentar con el token actual.
    const token = actual && usado !== `Bearer ${actual}` ? actual : await renovarSesion();
    reintento.headers.Authorization = `Bearer ${token}`;
    return api.request(reintento);
  },
);
