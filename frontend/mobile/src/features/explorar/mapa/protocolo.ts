import { z } from "zod";

// Mensajes entre la app y el mapa (Leaflet dentro de react-native-webview). Todo lo que sabe de
// este protocolo está en features/explorar/mapa: para pasar a MapLibre, se cambia este módulo y
// la pantalla no se toca.

export type Coordenada = { lat: number; lng: number };

/** Categoría del pin (ícono y color). */
export type CategoriaPin = "veterinaria" | "peluqueria" | "tienda" | "otro";

export type Pin = {
  id: number;
  lat: number;
  lng: number;
  categoria: CategoriaPin;
  /** Texto del pin: la calificación ("4,9") o "Nuevo" sin reseñas. */
  etiqueta: string;
};

/** App -> mapa. */
export type MensajeAlMapa =
  | { tipo: "pines"; pines: Pin[] }
  | { tipo: "seleccionar"; id: number | null }
  | { tipo: "centrar"; lat: number; lng: number; zoom?: number }
  | { tipo: "miUbicacion"; lat: number; lng: number };

const numero = z.number().finite();

/** Mapa -> app. Lo que no cumple el esquema se ignora (no es de confianza). */
export const mensajeDelMapa = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("listo") }),
  z.object({ tipo: z.literal("pin"), id: z.number().int().positive() }),
  z.object({ tipo: z.literal("fondo") }),
  z.object({ tipo: z.literal("teselas"), estado: z.enum(["ok", "error"]) }),
  z.object({ tipo: z.literal("movido"), lat: numero, lng: numero, zoom: numero }),
]);

export type MensajeDelMapa = z.infer<typeof mensajeDelMapa>;

/** El texto que llega de window.ReactNativeWebView.postMessage, validado (o null). */
export function leerMensaje(datos: string): MensajeDelMapa | null {
  try {
    const resultado = mensajeDelMapa.safeParse(JSON.parse(datos));
    return resultado.success ? resultado.data : null;
  } catch {
    return null;
  }
}

/** JavaScript que entrega un mensaje al mapa (para injectJavaScript). JSON: sin interpolar texto. */
export function scriptPara(mensaje: MensajeAlMapa): string {
  return `window.__petcat && window.__petcat.recibir(${JSON.stringify(mensaje)}); true;`;
}
