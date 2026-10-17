import type { ArchivoPrivado } from "@/api/salud";

/** Margen antes del vencimiento: una URL que vence en menos de esto ya no se usa. */
export const MARGEN_VENCIMIENTO_MS = 30_000;

/** La URL firmada venció o está por vencer. Los archivos externos no vencen. */
export const urlVencida = (archivo: ArchivoPrivado, ahora = Date.now()) =>
  !archivo.externo &&
  archivo.url_expira_en !== undefined &&
  new Date(archivo.url_expira_en).getTime() - MARGEN_VENCIMIENTO_MS <= ahora;

/**
 * Milisegundos hasta que venza la primera URL firmada (para que la consulta quede vieja a
 * tiempo y se vuelva a pedir), o Infinity si no hay ninguna.
 */
export function vigenciaRestante(archivos: ArchivoPrivado[], ahora = Date.now()): number {
  const vencimientos = archivos
    .filter((a) => !a.externo && a.url_expira_en)
    .map((a) => new Date(a.url_expira_en!).getTime() - MARGEN_VENCIMIENTO_MS - ahora);
  return vencimientos.length ? Math.max(0, Math.min(...vencimientos)) : Infinity;
}

/**
 * Abre un archivo privado en otra pestaña. La URL firmada no se guarda: si venció, se pide
 * otra vez el registro (`obtenerVigente`) y se abre la URL nueva. La pestaña se abre antes de
 * esperar a la API para que el navegador no la bloquee como ventana emergente.
 */
export async function abrirArchivoPrivado(
  archivo: ArchivoPrivado,
  obtenerVigente: () => Promise<ArchivoPrivado | undefined>,
): Promise<boolean> {
  if (!urlVencida(archivo)) {
    window.open(archivo.url, "_blank", "noopener,noreferrer");
    return true;
  }
  const pestana = window.open("", "_blank");
  const vigente = await obtenerVigente().catch(() => undefined);
  if (!vigente?.url) {
    pestana?.close();
    return false;
  }
  if (pestana) {
    pestana.opener = null;
    pestana.location.href = vigente.url;
  } else {
    window.open(vigente.url, "_blank", "noopener,noreferrer");
  }
  return true;
}
