import { addDays, format, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { parseFecha } from "./format";

/**
 * Cálculos del calendario de la agenda (B3 y B9), sin React. Las horas se manejan en
 * minutos desde la medianoche; un tramo es [inicio, fin) como en la API.
 */

export const MINUTOS_FILA = 15;

export interface Tramo {
  inicio: number;
  fin: number;
}

const dosDigitos = (n: number) => String(n).padStart(2, "0");

/** "08:30" o "08:30:00" -> 510 */
export function aMinutos(hora: string): number {
  const [h = 0, m = 0] = hora.split(":").map(Number);
  return h * 60 + m;
}

/** 510 -> "08:30" */
export const aHora = (minutos: number) =>
  `${dosDigitos(Math.floor(minutos / 60))}:${dosDigitos(minutos % 60)}`;

const iso = (fecha: Date) => format(fecha, "yyyy-MM-dd");

export const sumarDias = (fecha: string, dias: number) => iso(addDays(parseFecha(fecha), dias));

/** Lunes de la semana de `fecha` (la semana del panel va de lunes a domingo). */
export const lunesDe = (fecha: string) => iso(startOfWeek(parseFecha(fecha), { weekStartsOn: 1 }));

export const diasDeSemana = (fecha: string) =>
  Array.from({ length: 7 }, (_, i) => sumarDias(lunesDe(fecha), i));

/** 0 = domingo ... 6 = sábado, como `dia_semana` de la API. */
export const diaSemana = (fecha: string) => parseFecha(fecha).getDay();

/** Ordena y une los tramos que se cruzan o se tocan. */
export function unirTramos(tramos: readonly Tramo[]): Tramo[] {
  const ordenados = tramos.filter((t) => t.fin > t.inicio).sort((a, b) => a.inicio - b.inicio);
  const unidos: Tramo[] = [];
  for (const t of ordenados) {
    const ultimo = unidos.at(-1);
    if (ultimo && t.inicio <= ultimo.fin) ultimo.fin = Math.max(ultimo.fin, t.fin);
    else unidos.push({ ...t });
  }
  return unidos;
}

/** Lo que no cubren `abiertos` dentro de [desde, hasta). */
export function complemento(abiertos: readonly Tramo[], desde: number, hasta: number): Tramo[] {
  const huecos: Tramo[] = [];
  let cursor = desde;
  for (const t of unirTramos(abiertos)) {
    if (t.fin <= cursor) continue;
    if (t.inicio >= hasta) break;
    if (t.inicio > cursor) huecos.push({ inicio: cursor, fin: t.inicio });
    cursor = Math.max(cursor, t.fin);
  }
  if (cursor < hasta) huecos.push({ inicio: cursor, fin: hasta });
  return huecos;
}

/**
 * Horas que muestra el calendario: de la primera apertura (o cita) a la última, en horas
 * completas. Sin nada, de 08:00 a 18:00.
 */
export function ventanaVisible(tramos: readonly Tramo[]): Tramo {
  const validos = tramos.filter((t) => t.fin > t.inicio);
  if (validos.length === 0) return { inicio: 8 * 60, fin: 18 * 60 };
  const inicio = Math.floor(Math.min(...validos.map((t) => t.inicio)) / 60) * 60;
  const fin = Math.ceil(Math.max(...validos.map((t) => t.fin)) / 60) * 60;
  return { inicio, fin: Math.min(Math.max(fin, inicio + 60), 24 * 60) };
}

export interface TramoCerrado extends Tramo {
  etiqueta: string | null;
}

/**
 * Tramos cerrados de un día dentro de la ventana, con su etiqueta: "Cerrado 12:00–14:00"
 * (horario partido), "Cerrado desde las 12:00", "Abre a las 09:00" o "Cerrado" (todo el
 * día). Los huecos de menos de 30 minutos no llevan etiqueta.
 */
export function tramosCerrados(abiertos: readonly Tramo[], ventana: Tramo): TramoCerrado[] {
  const huecos = complemento(abiertos, ventana.inicio, ventana.fin);
  if (unirTramos(abiertos).every((t) => t.fin <= ventana.inicio || t.inicio >= ventana.fin)) {
    return [{ ...ventana, etiqueta: "Cerrado" }];
  }
  return huecos.map((h) => {
    let etiqueta: string | null = null;
    if (h.fin - h.inicio >= 30) {
      if (h.inicio === ventana.inicio) etiqueta = `Abre a las ${aHora(h.fin)}`;
      else if (h.fin === ventana.fin) etiqueta = `Cerrado desde las ${aHora(h.inicio)}`;
      else etiqueta = `Cerrado ${aHora(h.inicio)}–${aHora(h.fin)}`;
    }
    return { ...h, etiqueta };
  });
}

export interface Colocado<T> {
  item: T;
  /** Columna dentro de su grupo de citas que se cruzan (0 = la primera). */
  columna: number;
  /** Columnas del grupo: el ancho de cada cita es 1 / columnas. */
  columnas: number;
}

/**
 * Acomodo lado a lado: las citas que se cruzan (directa o encadenadamente) forman un
 * grupo; cada una va en la primera columna libre del grupo. Una cita sin duración
 * ocupa al menos una fila de 15 minutos.
 */
export function acomodar<T>(items: readonly T[], tramoDe: (item: T) => Tramo): Colocado<T>[] {
  const ordenados = items
    .map((item) => {
      const t = tramoDe(item);
      return { item, inicio: t.inicio, fin: Math.max(t.fin, t.inicio + MINUTOS_FILA) };
    })
    .sort((a, b) => a.inicio - b.inicio || b.fin - a.fin);

  const resultado: Colocado<T>[] = [];
  let grupo: Colocado<T>[] = [];
  let finesColumnas: number[] = [];
  let finGrupo = -1;

  const cerrarGrupo = () => {
    for (const c of grupo) c.columnas = finesColumnas.length;
    resultado.push(...grupo);
    grupo = [];
    finesColumnas = [];
  };

  for (const o of ordenados) {
    if (o.inicio >= finGrupo) cerrarGrupo();
    let columna = finesColumnas.findIndex((fin) => fin <= o.inicio);
    if (columna === -1) {
      columna = finesColumnas.length;
      finesColumnas.push(o.fin);
    } else {
      finesColumnas[columna] = o.fin;
    }
    grupo.push({ item: o.item, columna, columnas: 1 });
    finGrupo = Math.max(finGrupo, o.fin);
  }
  cerrarGrupo();
  return resultado;
}

const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);
const sinPunto = (texto: string) => texto.replace(".", "");

/** "Lun 22" */
export const encabezadoDia = (fecha: string) =>
  capitalizar(sinPunto(format(parseFecha(fecha), "EEE d", { locale: es })));

/** "Jueves 25 de septiembre, 2026" */
export const tituloDia = (fecha: string) =>
  capitalizar(format(parseFecha(fecha), "EEEE d 'de' MMMM, yyyy", { locale: es }));

/** "22 – 27 de septiembre, 2026", "29 sep – 4 oct, 2026" o "29 dic 2026 – 3 ene 2027". */
export function tituloRango(desde: string, hasta: string): string {
  const a = parseFecha(desde);
  const b = parseFecha(hasta);
  const corto = (d: Date, conAnio: boolean) =>
    sinPunto(format(d, conAnio ? "d MMM yyyy" : "d MMM", { locale: es }));
  if (a.getFullYear() !== b.getFullYear()) return `${corto(a, true)} – ${corto(b, true)}`;
  if (a.getMonth() !== b.getMonth()) return `${corto(a, false)} – ${corto(b, false)}, ${b.getFullYear()}`;
  return `${a.getDate()} – ${format(b, "d 'de' MMMM, yyyy", { locale: es })}`;
}

/** "JUEVES 25 SEP" para los grupos de la vista Lista. */
export const encabezadoGrupo = (fecha: string) =>
  sinPunto(format(parseFecha(fecha), "EEEE d MMM", { locale: es })).toLocaleUpperCase("es");

/** "Jue 25 sep, 9:30 a.m." para resumir una cita en una línea. */
export const fechaHoraCita = (fecha: string, hora: string) =>
  capitalizar(sinPunto(format(parseFecha(fecha), "EEE d MMM", { locale: es }))) +
  `, ${format(new Date(2000, 0, 1, ...(hora.split(":").slice(0, 2).map(Number) as [number, number])), "h:mm aaaa", { locale: es })}`;
