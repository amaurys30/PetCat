import { z } from "zod";

/** Centro de Sincelejo: punto de partida del mapa y sesgo de las búsquedas. */
export const SINCELEJO = { lat: 9.30472, lng: -75.39778 } as const;

export interface Ubicacion {
  direccion: string;
  latitud: number | null;
  longitud: number | null;
}

/** Clave de Google Maps (opcional). Sin ella, las sedes usan latitud y longitud manuales. */
export const claveMaps = (): string => import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";

/** `AdvancedMarker` exige un Map ID; sin uno propio, Google ofrece DEMO_MAP_ID para desarrollo. */
export const mapId = (): string => import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

/** Enlace para revisar el punto en Google Maps (no necesita clave). */
export const enlaceGoogleMaps = (latitud: number, longitud: number) =>
  `https://www.google.com/maps/search/?api=1&query=${latitud},${longitud}`;

/** Redondea a 6 decimales (unos 10 cm): suficiente y legible. */
export const redondear = (valor: number) => Math.round(valor * 1e6) / 1e6;

const coordenada = (min: number, max: number, nombre: string) =>
  z
    .number({ error: `${nombre} inválida` })
    .min(min, `${nombre} debe estar entre ${min} y ${max}`)
    .max(max, `${nombre} debe estar entre ${min} y ${max}`)
    .nullable();

/** Campos de ubicación para los esquemas de sede: van juntas o ninguna, como en la API. */
export const camposCoordenadas = {
  latitud: coordenada(-90, 90, "Latitud"),
  longitud: coordenada(-180, 180, "Longitud"),
};

export function coordenadasJuntas(
  valores: { latitud: number | null; longitud: number | null },
  ctx: z.RefinementCtx,
) {
  const { latitud, longitud } = valores;
  if (latitud !== null && longitud === null) {
    ctx.addIssue({ code: "custom", path: ["longitud"], message: "Escribe también la longitud" });
  }
  if (longitud !== null && latitud === null) {
    ctx.addIssue({ code: "custom", path: ["latitud"], message: "Escribe también la latitud" });
  }
}
