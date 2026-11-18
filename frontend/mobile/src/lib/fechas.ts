// Fechas en hora de Colombia sin depender de Intl ni de la zona del teléfono.
// Colombia está siempre en UTC−5 y no tiene horario de verano: un desfase fijo da el mismo
// resultado en Hermes y en Node, y no se corre el día aunque el teléfono esté en otra zona.

export const DESFASE_BOGOTA_MS = -5 * 60 * 60 * 1000;

export type FechaCalendario = { anio: number; mes: number; dia: number; diaSemana: number };
export type HoraReloj = { hora: number; minuto: number };

/** Partes de un instante en hora de Bogotá. `mes` va de 1 a 12; `diaSemana` 0 = domingo. */
export function partesEnBogota(instante: Date): FechaCalendario & HoraReloj {
  const d = new Date(instante.getTime() + DESFASE_BOGOTA_MS);
  return {
    anio: d.getUTCFullYear(),
    mes: d.getUTCMonth() + 1,
    dia: d.getUTCDate(),
    diaSemana: d.getUTCDay(),
    hora: d.getUTCHours(),
    minuto: d.getUTCMinutes(),
  };
}

const FECHA_API = /^(\d{4})-(\d{2})-(\d{2})/;
const HORA_API = /^(\d{1,2}):(\d{2})/;

/**
 * Lee una fecha de la API (`YYYY-MM-DD` o `YYYY-MM-DD HH:MM:SS`), que ya viene en hora de
 * Bogotá. Nunca usar `new Date('YYYY-MM-DD')`: se interpreta como UTC y corre el día.
 */
export function parsearFechaApi(texto: string): FechaCalendario {
  const m = FECHA_API.exec(texto);
  if (!m) throw new Error(`Fecha inválida: ${texto}`);
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return { anio, mes, dia, diaSemana };
}

/** Lee una hora de la API (`HH:MM` o `HH:MM:SS`, o la parte de hora de un DATETIME). */
export function parsearHoraApi(texto: string): HoraReloj {
  const parteHora = texto.includes(" ") ? texto.split(" ")[1] : texto;
  const m = HORA_API.exec(parteHora);
  if (!m) throw new Error(`Hora inválida: ${texto}`);
  return { hora: Number(m[1]), minuto: Number(m[2]) };
}

const dos = (n: number) => String(n).padStart(2, "0");

/** Fecha de hoy en Bogotá, en el formato de la API. */
export function hoyEnBogota(ahora: Date = new Date()): string {
  const { anio, mes, dia } = partesEnBogota(ahora);
  return `${anio}-${dos(mes)}-${dos(dia)}`;
}
