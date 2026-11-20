import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

// Foto de la mascota: elegirla, y comprimirla antes de subir (la API acepta hasta 5 MB en JPEG,
// PNG o WebP; no HEIC). Re-codificarla en JPEG la deja en unos cientos de KB, convierte las HEIC
// del iPhone y no copia los metadatos; la API además quita EXIF y GPS al guardarla.

export const LADO_MAXIMO = 1200;
export const CALIDAD_JPEG = 0.8;

type Imagen = { uri: string; width: number; height: number };

/** Reduce el lado mayor a 1200 px (sin agrandar) y la guarda en JPEG. Devuelve la URI nueva. */
export async function prepararFoto({ uri, width, height }: Imagen): Promise<string> {
  const contexto = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > LADO_MAXIMO) {
    contexto.resize(width >= height ? { width: LADO_MAXIMO } : { height: LADO_MAXIMO });
  }
  const imagen = await contexto.renderAsync();
  const resultado = await imagen.saveAsync({ compress: CALIDAD_JPEG, format: SaveFormat.JPEG });
  return resultado.uri;
}

const OPCIONES: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 1,
  exif: false,
};

export type ResultadoFoto =
  | { estado: "lista"; uri: string }
  | { estado: "cancelada" }
  | { estado: "sin_permiso"; puedePedirOtraVez: boolean };

async function procesar(resultado: ImagePicker.ImagePickerResult): Promise<ResultadoFoto> {
  const asset = resultado.canceled ? undefined : resultado.assets[0];
  if (!asset) return { estado: "cancelada" };
  return { estado: "lista", uri: await prepararFoto(asset) };
}

/** Galería: el selector del sistema no pide permiso (Android 13+ e iOS 14+). */
export async function elegirDeGaleria(): Promise<ResultadoFoto> {
  return procesar(await ImagePicker.launchImageLibraryAsync(OPCIONES));
}

/** Cámara: pide el permiso (la pantalla explica antes para qué) y toma la foto. */
export async function tomarFoto(): Promise<ResultadoFoto> {
  const permiso = await ImagePicker.requestCameraPermissionsAsync();
  if (!permiso.granted) return { estado: "sin_permiso", puedePedirOtraVez: permiso.canAskAgain };
  return procesar(await ImagePicker.launchCameraAsync(OPCIONES));
}
