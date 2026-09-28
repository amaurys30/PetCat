import multer from "multer";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { ApiError } from "../errors/ApiError.js";

/**
 * Subida de archivos: recepción en memoria (multer), tipo real por contenido
 * (file-type, sin confiar en la extensión ni en el Content-Type) y procesamiento de
 * imágenes con sharp (orientación aplicada, tamaño máximo y sin metadatos EXIF/GPS).
 *
 *   router.put("/mascotas/:id_mascota/foto", authMiddleware, validate(...),
 *     recibirArchivos("mascota_foto"), controller.subirFoto);
 *   const procesado = await procesarArchivo(archivoUnico(req, "mascota_foto"), "mascota_foto");
 */

const MB = 1024 * 1024;
const LADO_MAXIMO = 2048;
// Contra "bombas de descompresión": imágenes pequeñas en bytes con dimensiones enormes.
export const MAX_MEGAPIXELES = 40;

const IMAGENES = ["image/jpeg", "image/png", "image/webp"];
const PDF = "application/pdf";
const HEIC = ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence", "image/avif"];

const imagenPublica = (campo, maxMB) => ({ campo, maxBytes: maxMB * MB, maxArchivos: 1, pdf: false, privado: false });

/**
 * Reglas por destino (el nombre coincide con `archivos.entidad`). Las públicas se guardan
 * en WebP; las privadas (médicas) en JPEG, más compatible al descargarlas.
 */
export const DESTINOS = {
  usuario_foto: imagenPublica("foto", 5),
  mascota_foto: imagenPublica("foto", 5),
  empleado_foto: imagenPublica("foto", 5),
  negocio_logo: imagenPublica("logo", 5),
  negocio_banner: imagenPublica("banner", 8),
  vacuna_comprobante: { campo: "comprobante", maxBytes: 10 * MB, maxArchivos: 1, pdf: true, privado: true },
  historial_archivo: { campo: "archivos", maxBytes: 10 * MB, maxArchivos: 5, pdf: true, privado: true },
};

const invalido = (mensaje) => ApiError.unprocessable("Archivo inválido", { archivo: mensaje });

const destinoDe = (entidad) => {
  const destino = DESTINOS[entidad];
  if (!destino) throw new Error(`Destino de archivo desconocido: ${entidad}`);
  return destino;
};

const tiposAdmitidos = (destino) => (destino.pdf ? "JPEG, PNG, WebP o PDF" : "JPEG, PNG o WebP");

const traducirErrorMulter = (err, destino) => {
  if (!(err instanceof multer.MulterError)) return ApiError.badRequest("No se pudo leer el formulario (multipart) enviado");
  const maximo =
    destino.maxArchivos === 1 ? "Se puede enviar un solo archivo" : `Se pueden enviar como máximo ${destino.maxArchivos} archivos`;
  switch (err.code) {
    case "LIMIT_FILE_SIZE":
      return invalido(`El archivo supera el máximo de ${destino.maxBytes / MB} MB`);
    case "LIMIT_FILE_COUNT":
      return invalido(maximo);
    case "LIMIT_UNEXPECTED_FILE":
      // Con upload.single/array, un archivo de más en el mismo campo también llega como "inesperado".
      return err.field === destino.campo ? invalido(maximo) : invalido(`El archivo debe enviarse en el campo "${destino.campo}"`);
    default:
      return ApiError.badRequest("No se pudo leer el formulario (multipart) enviado");
  }
};

/**
 * Middleware que recibe el archivo (o los archivos) del destino en memoria, con su
 * límite de tamaño y cantidad. Los errores de multer se traducen a 422 en `errors.archivo`.
 * Si la solicitud no es multipart no hace nada: `archivoUnico`/`archivosDe` dan el 422.
 */
export const recibirArchivos = (entidad) => {
  const destino = destinoDe(entidad);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: destino.maxBytes, files: destino.maxArchivos, fields: 10 },
  });
  const handler = destino.maxArchivos === 1 ? upload.single(destino.campo) : upload.array(destino.campo, destino.maxArchivos);
  return (req, res, next) => handler(req, res, (err) => next(err ? traducirErrorMulter(err, destino) : undefined));
};

/** El archivo de un destino de un solo archivo; 422 si no llegó. */
export const archivoUnico = (req, entidad) => {
  const destino = destinoDe(entidad);
  if (!req.file) throw invalido(`Falta el archivo: envíalo como multipart/form-data en el campo "${destino.campo}"`);
  return req.file;
};

/** Los archivos de un destino de varios archivos; 422 si no llegó ninguno. */
export const archivosDe = (req, entidad) => {
  const destino = destinoDe(entidad);
  if (!req.files?.length) throw invalido(`Faltan los archivos: envíalos como multipart/form-data en el campo "${destino.campo}"`);
  return req.files;
};

/**
 * multer entrega el nombre en latin1; se recupera el UTF-8, se quitan rutas y
 * caracteres de control y se recorta. Solo se guarda en la base, nunca en Cloudinary.
 */
export const limpiarNombre = (nombre) => {
  if (!nombre) return null;
  const utf8 = Buffer.from(nombre, "latin1").toString("utf8");
  const base = utf8.split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return base.slice(0, 255) || null;
};

const procesarImagen = async (buffer, destino) => {
  try {
    let imagen = sharp(buffer, { limitInputPixels: MAX_MEGAPIXELES * 1_000_000, failOn: "error" })
      .rotate() // aplica la orientación EXIF antes de descartar los metadatos
      .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: "inside", withoutEnlargement: true });
    // sharp no copia metadatos (EXIF, GPS, XMP, ICC) salvo que se pida con keepMetadata/withMetadata.
    imagen = destino.privado
      ? imagen.flatten({ background: "#ffffff" }).jpeg({ quality: 85, mozjpeg: true })
      : imagen.webp({ quality: 82 });
    const { data, info } = await imagen.toBuffer({ resolveWithObject: true });
    return {
      buffer: data,
      tipoRecurso: "image",
      formato: info.format === "jpeg" ? "jpg" : info.format,
      bytes: data.length,
      ancho: info.width,
      alto: info.height,
    };
  } catch (err) {
    if (/pixel limit/i.test(err.message)) {
      throw invalido(`La imagen supera el máximo de ${MAX_MEGAPIXELES} megapíxeles`);
    }
    throw invalido("La imagen está dañada o no se puede leer");
  }
};

/**
 * Valida el tipo real del archivo y lo deja listo para subir:
 * `{ buffer, tipoRecurso, formato, bytes, ancho, alto, nombre_original }`.
 * Imágenes: re-codificadas sin metadatos. PDF (solo historial y comprobantes): sin cambios.
 */
export const procesarArchivo = async (archivo, entidad) => {
  const destino = destinoDe(entidad);
  const tipo = await fileTypeFromBuffer(archivo.buffer);
  const nombre_original = limpiarNombre(archivo.originalname);

  if (tipo && HEIC.includes(tipo.mime)) {
    throw invalido("Las fotos HEIC/HEIF no se admiten: conviértelas a JPEG antes de subirlas");
  }
  if (tipo && IMAGENES.includes(tipo.mime)) {
    return { ...(await procesarImagen(archivo.buffer, destino)), nombre_original };
  }
  if (tipo?.mime === PDF && destino.pdf) {
    return { buffer: archivo.buffer, tipoRecurso: "raw", formato: "pdf", bytes: archivo.buffer.length, ancho: null, alto: null, nombre_original };
  }
  throw invalido(`Tipo de archivo no admitido: debe ser ${tiposAdmitidos(destino)}`);
};
