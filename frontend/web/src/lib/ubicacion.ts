import { z } from "zod";

/** Centro de Sincelejo: punto de partida del mapa. */
export const SINCELEJO = { lat: 9.30472, lng: -75.39778 } as const;

export interface Ubicacion {
  direccion: string;
  latitud: number | null;
  longitud: number | null;
}

const MOSAICOS_OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATRIBUCION_OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/**
 * Mosaicos del mapa. Por defecto, OpenStreetMap (sin clave; su política de uso exige la
 * atribución visible y no descargar mosaicos en masa). Para cambiar de proveedor basta con
 * `VITE_MAP_TILES_URL` (plantilla con `{z}`, `{x}`, `{y}` y, si usa subdominios, `{s}`) y
 * `VITE_MAP_ATTRIBUTION` con la atribución que exija.
 */
export const capaMapa = () => {
  const url = import.meta.env.VITE_MAP_TILES_URL || MOSAICOS_OSM;
  const atribucion = import.meta.env.VITE_MAP_ATTRIBUTION || (url === MOSAICOS_OSM ? ATRIBUCION_OSM : "");
  return { url, atribucion };
};

/** Enlace para revisar el punto en OpenStreetMap. */
export const enlaceMapa = (latitud: number, longitud: number) =>
  `https://www.openstreetmap.org/?mlat=${latitud}&mlon=${longitud}#map=17/${latitud}/${longitud}`;

/** Hay un punto válido para mostrar en el mapa. */
export const tienePunto = (
  u: Pick<Ubicacion, "latitud" | "longitud">,
): u is { latitud: number; longitud: number } =>
  u.latitud !== null && u.longitud !== null && Number.isFinite(u.latitud) && Number.isFinite(u.longitud);

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
