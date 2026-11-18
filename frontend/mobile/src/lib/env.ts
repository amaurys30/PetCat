import Constants from "expo-constants";
import { Platform } from "react-native";
import { z } from "zod";

// Variables EXPO_PUBLIC_*: quedan dentro del bundle, nunca secretos.
// Se leen una por una con process.env.EXPO_PUBLIC_X para que Expo pueda reemplazarlas al compilar.

const PUERTO_API_DEMO = 3001;

const urlHttp = (nombre: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim().replace(/\/+$/, "") : undefined),
    z.url({ protocol: /^https?$/, error: `${nombre} debe ser una URL http(s) completa` }).optional(),
  );

const esquema = z.object({
  EXPO_PUBLIC_API_URL: urlHttp("EXPO_PUBLIC_API_URL"),
  EXPO_PUBLIC_SOCKET_URL: urlHttp("EXPO_PUBLIC_SOCKET_URL"),
});

export type VariablesEnv = z.input<typeof esquema>;
export type Env = { apiUrl: string; socketUrl: string };
type Contexto = { hostUri?: string | null; plataforma: string };

/**
 * Sin EXPO_PUBLIC_API_URL, en desarrollo se usa la IP con la que Expo sirve el bundle (la que
 * muestra la terminal; el teléfono ya llega a ella) con el puerto de la API de demo. Con el
 * túnel de Expo (*.exp.direct) eso no sirve y hace falta la variable.
 */
function urlPorDefecto({ hostUri, plataforma }: Contexto) {
  const host = hostUri ? hostUri.split(":")[0] : "";
  if (host && !host.endsWith(".exp.direct")) return `http://${host}:${PUERTO_API_DEMO}/api/v1`;
  const local = plataforma === "android" ? "10.0.2.2" : "localhost";
  return `http://${local}:${PUERTO_API_DEMO}/api/v1`;
}

export function leerEnv(variables: VariablesEnv, contexto: Contexto): Env {
  const resultado = esquema.safeParse(variables);
  if (!resultado.success) {
    const detalle = resultado.error.issues.map((i) => i.message).join("; ");
    throw new Error(`Configuración inválida en .env: ${detalle}`);
  }
  const apiUrl = resultado.data.EXPO_PUBLIC_API_URL ?? urlPorDefecto(contexto);
  const origen = /^https?:\/\/[^/]+/.exec(apiUrl)?.[0] ?? apiUrl;
  return { apiUrl, socketUrl: resultado.data.EXPO_PUBLIC_SOCKET_URL ?? origen };
}

export const env = leerEnv(
  {
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_SOCKET_URL: process.env.EXPO_PUBLIC_SOCKET_URL,
  },
  { hostUri: Constants.expoConfig?.hostUri, plataforma: Platform.OS },
);
