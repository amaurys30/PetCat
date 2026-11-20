import { hoyEnBogota } from "./fechas";

// Campo de fecha "dd/mm/aaaa" escrito con el teclado numérico (más fácil con lector de pantalla
// que un selector de fecha). Se guarda como "YYYY-MM-DD", el formato de la API.

/** Mientras se escribe: solo dígitos y las barras en su lugar ("15032" → "15/03/2"). */
export function aplicarMascaraFecha(texto: string): string {
  const digitos = texto.replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

/** "15/03/2021" → "2021-03-15"; null si no es una fecha completa y real (31/02 no existe). */
export function mascaraAFechaApi(texto: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!m) return null;
  const [dia, mes, anio] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia)
    return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** "2021-03-15" → "15/03/2021" (para editar). */
export function fechaApiAMascara(fecha: string | null | undefined): string {
  if (!fecha) return "";
  const [anio, mes, dia] = fecha.slice(0, 10).split("-");
  return `${dia}/${mes}/${anio}`;
}

/** true si la fecha (de la API) es posterior a hoy en Bogotá. */
export const esFutura = (fechaApi: string, ahora: Date = new Date()) => fechaApi > hoyEnBogota(ahora);
