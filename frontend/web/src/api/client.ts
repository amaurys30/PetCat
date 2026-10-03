import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import { toApiError } from "./errors";
import { API_URL, getAccessToken, renovarSesion } from "./sesion";
import type { Pagina, Respuesta } from "./types";

/**
 * Cliente HTTP del panel. Los componentes nunca lo usan directo: cada módulo expone
 * funciones en src/api/<modulo>.ts. Todo error sale como ApiError (errors.ts).
 */

declare module "axios" {
  interface AxiosRequestConfig {
    /** No intentar renovar la sesión con un 401 (login, recuperación de contraseña...). */
    sinRenovar?: boolean;
  }
}

interface ConfigReintento extends InternalAxiosRequestConfig {
  _reintentada?: boolean;
}

export const http = axios.create({ baseURL: API_URL, timeout: 20_000 });

http.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (respuesta) => respuesta,
  async (error) => {
    const config = (error as { config?: ConfigReintento }).config;
    const status = (error as { response?: { status?: number } }).response?.status;

    // 401: un solo intento de renovar y repetir la petición.
    if (status === 401 && config && !config._reintentada && !config.sinRenovar) {
      config._reintentada = true;
      const token = await renovarSesion(); // si falla, lanza ApiError y la sesión se cierra
      config.headers.Authorization = `Bearer ${token}`;
      return http(config);
    }
    throw toApiError(error);
  },
);

export async function apiGet<T>(url: string, params?: object, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.get<Respuesta<T>>(url, { ...config, params });
  return data.data;
}

export async function apiGetPagina<T>(url: string, params?: object): Promise<Pagina<T>> {
  const { data } = await http.get<Respuesta<T[]>>(url, { params });
  if (!data.meta) throw new Error(`La respuesta de ${url} no trae meta de paginación`);
  return { data: data.data, meta: data.meta };
}

export async function apiPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.post<Respuesta<T>>(url, body, config);
  return data.data;
}

export async function apiPut<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.put<Respuesta<T>>(url, body, config);
  return data.data;
}

export async function apiPatch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.patch<Respuesta<T>>(url, body, config);
  return data.data;
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.delete<Respuesta<T>>(url, config);
  return data.data;
}
