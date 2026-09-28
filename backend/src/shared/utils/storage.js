import { randomBytes } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { env, isTest } from "../../config/env.js";
import { ApiError } from "../errors/ApiError.js";

/**
 * Almacenamiento de archivos. Tres implementaciones con la misma interfaz:
 * Cloudinary, en memoria (tests) y "sin configurar" (desarrollo sin credenciales).
 *
 *   subir(buffer, { carpeta, privado, tipoRecurso, formato })
 *     -> { public_id, tipo_recurso, entrega, formato, bytes }
 *   eliminar({ public_id, tipo_recurso, entrega })
 *   urlPublica(public_id, variante)          variante: "media" | "miniatura"
 *   varianteDeUrl(url, variante)             otra variante de una URL pública guardada
 *                                            (una URL externa se devuelve igual)
 *   urlFirmada({ public_id, tipo_recurso, formato }) -> { url, expira_en }
 *
 * Públicos (`privado: false`): tipo `upload`, se sirven por la CDN con las variantes.
 * Privados: tipo `authenticated`; solo se entregan con URLs firmadas que vencen a los
 * ARCHIVOS_URL_VIGENCIA_MIN minutos (`private_download_url` con `expires_at`).
 */

// Versiones de las imágenes públicas para la app. Se generan al subir (eager).
export const VARIANTES = {
  media: { width: 800, height: 800, crop: "limit", fetch_format: "auto", quality: "auto" },
  miniatura: { width: 200, height: 200, crop: "fill", gravity: "center", fetch_format: "auto", quality: "auto" },
};

const TIMEOUT_MS = 60_000;

/** public_id aleatorio dentro de la carpeta del entorno; los PDF (raw) llevan la extensión. */
const nuevoPublicId = (carpeta, tipoRecurso) =>
  `${env.CLOUDINARY_FOLDER}/${carpeta}/${randomBytes(12).toString("hex")}${tipoRecurso === "raw" ? ".pdf" : ""}`;

const vencimiento = () => {
  const segundos = env.ARCHIVOS_URL_VIGENCIA_MIN * 60;
  const expira = Math.floor(Date.now() / 1000) + segundos;
  return { expira, expira_en: new Date(expira * 1000).toISOString() };
};

/**
 * Las columnas *_url guardan la URL de la variante "media"; las demás variantes se
 * derivan de ella. Una URL que no es de este almacenamiento (externa) se devuelve igual.
 */
const varianteDeUrl = (urlPublica) => {
  const marcador = "__PUBLIC_ID__";
  const prefijo = urlPublica(marcador, "media").split(marcador)[0];
  return (url, variante) => {
    if (!url || !url.startsWith(prefijo)) return url ?? null;
    return urlPublica(url.slice(prefijo.length), variante);
  };
};

// ---------- Cloudinary ----------

const crearCloudinary = () => {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
    // Sin el parámetro de analítica (?_a=) para que las URLs sean estables.
    analytics: false,
  });

  const urlPublica = (public_id, variante) =>
    cloudinary.url(public_id, {
      secure: true,
      type: "upload",
      resource_type: "image",
      transformation: [VARIANTES[variante]],
      // Sin "v1/": la URL queda como prefijo + public_id (ver varianteDeUrl).
      force_version: false,
    });

  return {
    configurado: true,

    subir: (buffer, { carpeta, privado, tipoRecurso, formato }) =>
      new Promise((resolve, reject) => {
        const entrega = privado ? "authenticated" : "upload";
        const stream = cloudinary.uploader.upload_stream(
          {
            public_id: nuevoPublicId(carpeta, tipoRecurso),
            resource_type: tipoRecurso,
            type: entrega,
            overwrite: false,
            timeout: TIMEOUT_MS,
            ...(tipoRecurso === "image" && { format: formato }),
            ...(!privado && tipoRecurso === "image" && { eager: Object.values(VARIANTES) }),
          },
          (error, result) => {
            if (error) {
              console.error("[storage] Error al subir a Cloudinary:", error.message);
              return reject(ApiError.serviceUnavailable("No se pudo guardar el archivo, intenta de nuevo"));
            }
            resolve({
              public_id: result.public_id,
              tipo_recurso: tipoRecurso,
              entrega,
              formato,
              bytes: result.bytes,
            });
          }
        );
        stream.end(buffer);
      }),

    eliminar: async ({ public_id, tipo_recurso, entrega }) => {
      const result = await cloudinary.uploader.destroy(public_id, {
        resource_type: tipo_recurso,
        type: entrega,
        invalidate: true,
      });
      // "not found" también cuenta como eliminado: el archivo ya no está.
      if (result.result !== "ok" && result.result !== "not found") {
        throw new Error(`Cloudinary no eliminó ${public_id}: ${result.result}`);
      }
    },

    urlPublica,
    varianteDeUrl: varianteDeUrl(urlPublica),

    urlFirmada: ({ public_id, tipo_recurso, formato }) => {
      const { expira, expira_en } = vencimiento();
      const url = cloudinary.utils.private_download_url(public_id, tipo_recurso === "raw" ? "" : formato, {
        resource_type: tipo_recurso,
        type: "authenticated",
        expires_at: expira,
      });
      return { url, expira_en };
    },
  };
};

// ---------- En memoria (tests) ----------

/**
 * Guarda los archivos en un Map. Los tests leen `archivos` (buffer y opciones de cada
 * subida) y simulan fallos con `fallarAlSubir` y `fallarAlEliminar`.
 */
const urlMemoria = (public_id, variante) => `https://almacenamiento.test/${variante}/${public_id}`;

const crearMemoria = () => {
  const archivos = new Map();
  const memoria = {
    configurado: true,
    archivos,
    fallarAlSubir: false,
    fallarAlEliminar: false,

    subir: async (buffer, { carpeta, privado, tipoRecurso, formato }) => {
      if (memoria.fallarAlSubir) throw ApiError.serviceUnavailable("No se pudo guardar el archivo, intenta de nuevo");
      const public_id = nuevoPublicId(carpeta, tipoRecurso);
      const entrega = privado ? "authenticated" : "upload";
      archivos.set(public_id, { buffer, carpeta, entrega, tipoRecurso, formato });
      return { public_id, tipo_recurso: tipoRecurso, entrega, formato, bytes: buffer.length };
    },

    eliminar: async ({ public_id }) => {
      if (memoria.fallarAlEliminar) throw new Error("Fallo simulado al eliminar");
      archivos.delete(public_id);
    },

    urlPublica: urlMemoria,
    varianteDeUrl: varianteDeUrl(urlMemoria),

    urlFirmada: ({ public_id }) => {
      const { expira, expira_en } = vencimiento();
      return { url: `https://almacenamiento.test/privado/${public_id}?expira=${expira}`, expira_en };
    },

    /** Deja el almacenamiento vacío y sin fallos simulados. */
    reiniciar: () => {
      archivos.clear();
      memoria.fallarAlSubir = false;
      memoria.fallarAlEliminar = false;
    },
  };
  return memoria;
};

// ---------- Sin configurar (desarrollo sin credenciales) ----------

export const almacenamientoSinConfigurar = {
  configurado: false,
  subir: async () => {
    throw ApiError.serviceUnavailable(
      "El almacenamiento de archivos no está configurado (faltan las credenciales de Cloudinary)"
    );
  },
  eliminar: async () => {
    throw new Error("El almacenamiento de archivos no está configurado");
  },
  urlPublica: () => null,
  varianteDeUrl: (url) => url,
  urlFirmada: () => ({ url: null, expira_en: null }),
};

const elegir = () => {
  if (isTest) return crearMemoria();
  if (env.CLOUDINARY_CLOUD_NAME) return crearCloudinary();
  console.warn("[storage] Sin credenciales de Cloudinary: las subidas de archivos responderán 503.");
  return almacenamientoSinConfigurar;
};

export const storage = elegir();

export default storage;
