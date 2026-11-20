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

/** Teselas por defecto: las públicas de OpenStreetMap (solo para desarrollo; ver "Antes de publicar"). */
export const TESELAS_POR_DEFECTO = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const ATRIBUCION_POR_DEFECTO = "© OpenStreetMap";

const vacioAIndefinido = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

const esquema = z.object({
  EXPO_PUBLIC_API_URL: urlHttp("EXPO_PUBLIC_API_URL"),
  EXPO_PUBLIC_SOCKET_URL: urlHttp("EXPO_PUBLIC_SOCKET_URL"),
  // Plantilla de teselas de Leaflet: http(s), con {z}, {x} y {y} (y {s} si usa subdominios).
  EXPO_PUBLIC_MAP_TILES_URL: z.preprocess(
    vacioAIndefinido,
    z
      .string()
      .regex(/^https?:\/\/[^/\s]+\/\S*$/, "EXPO_PUBLIC_MAP_TILES_URL debe ser una URL http(s)")
      .refine(
        (v) => ["{z}", "{x}", "{y}"].every((p) => v.includes(p)),
        "EXPO_PUBLIC_MAP_TILES_URL debe tener {z}, {x} y {y}",
      )
      .optional(),
  ),
  EXPO_PUBLIC_MAP_ATTRIBUTION: z.preprocess(vacioAIndefinido, z.string().max(200).optional()),
});

export type VariablesEnv = z.input<typeof esquema>;
export type Env = { apiUrl: string; socketUrl: string; mapa: { teselas: string; atribucion: string } };
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
  return {
    apiUrl,
    socketUrl: resultado.data.EXPO_PUBLIC_SOCKET_URL ?? origen,
    mapa: {
      teselas: resultado.data.EXPO_PUBLIC_MAP_TILES_URL ?? TESELAS_POR_DEFECTO,
      atribucion: resultado.data.EXPO_PUBLIC_MAP_ATTRIBUTION ?? ATRIBUCION_POR_DEFECTO,
    },
  };
}

export const env = leerEnv(
  {
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_SOCKET_URL: process.env.EXPO_PUBLIC_SOCKET_URL,
    EXPO_PUBLIC_MAP_TILES_URL: process.env.EXPO_PUBLIC_MAP_TILES_URL,
    EXPO_PUBLIC_MAP_ATTRIBUTION: process.env.EXPO_PUBLIC_MAP_ATTRIBUTION,
  },
  { hostUri: Constants.expoConfig?.hostUri, plataforma: Platform.OS },
);
