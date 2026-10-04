import { format, formatDistanceStrict } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Fechas, horas y dinero. La API envía fechas "YYYY-MM-DD", fechas con hora
 * "YYYY-MM-DD HH:MM:SS" y horas "HH:MM" ya en hora de Bogotá, sin zona.
 * Nunca usar `new Date("YYYY-MM-DD")`: se interpreta como UTC y corre el día.
 */
export const ZONA_HORARIA = "America/Bogota";

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const FECHA_HORA = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

/** Fecha de calendario como Date local (medianoche), sin desplazamiento de zona. */
export function parseFecha(fecha: string): Date {
  const m = FECHA.exec(fecha);
  if (!m) throw new Error(`Fecha inválida: ${fecha}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** "YYYY-MM-DD HH:MM[:SS]" de Bogotá como Date local con los mismos números. */
export function parseFechaHora(valor: string): Date {
  const m = FECHA_HORA.exec(valor);
  if (!m) throw new Error(`Fecha y hora inválidas: ${valor}`);
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] ?? 0),
  );
}

const partesBogota = (ahora: Date) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONA_HORARIA,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(ahora)
      .map((p) => [p.type, p.value]),
  );

/** Hoy en Bogotá como "YYYY-MM-DD", sin importar la zona del navegador. */
export function hoyISO(ahora: Date = new Date()): string {
  const p = partesBogota(ahora);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Ahora en Bogotá como Date local con los mismos números (para comparar con parseFechaHora). */
function ahoraBogota(ahora: Date): Date {
  const p = partesBogota(ahora);
  return new Date(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
}

/** Tiempo hasta un "YYYY-MM-DD HH:MM[:SS]" de Bogotá: "2 días", "5 horas", "1 minuto". */
export function tiempoHasta(valor: string, ahora: Date = new Date()): string {
  return formatDistanceStrict(parseFechaHora(valor), ahoraBogota(ahora), { locale: es, roundingMethod: "floor" });
}

/** "jueves, 25 de septiembre de 2026" */
export function fechaLarga(fecha: string): string {
  return format(parseFecha(fecha), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
}

/** "Jueves, 25 de septiembre de 2026" (para títulos) */
export function fechaLargaTitulo(fecha: string): string {
  const texto = fechaLarga(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "25 sep 2026" */
export function fechaCorta(fecha: string): string {
  return format(parseFecha(fecha), "d MMM yyyy", { locale: es }).replace(".", "");
}

/** "14:30:00" o "14:30" -> "14:30" */
export function hora(valor: string): string {
  const m = /^(\d{2}):(\d{2})/.exec(valor);
  if (!m) throw new Error(`Hora inválida: ${valor}`);
  return `${m[1]}:${m[2]}`;
}

/** "2026-09-25 14:30:00" -> "25 sep 2026, 14:30" */
export function fechaHora(valor: string): string {
  const [fecha, horaTexto] = valor.split(/[ T]/);
  if (!fecha || !horaTexto) throw new Error(`Fecha y hora inválidas: ${valor}`);
  return `${fechaCorta(fecha)}, ${hora(horaTexto)}`;
}

/** "2026-09-28 09:00:00" -> "28 de septiembre, 9:00 a.m." (vencimientos en una frase) */
export function fechaHoraLarga(valor: string): string {
  return format(parseFechaHora(valor), "d 'de' MMMM, h:mm aaaa", { locale: es });
}

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** 1850000 -> "$ 1.850.000" */
export function dinero(valor: number): string {
  return COP.format(valor);
}

/**
 * Iniciales para avatares: primera letra de la primera y la última palabra con letras.
 * "Clínica Veterinaria Patitas" -> "CP", "Valentina Torres" -> "VT", "Huellitas" -> "HU".
 */
export function iniciales(nombre: string): string {
  const palabras = nombre
    .trim()
    .split(/\s+/)
    .filter((p) => /\p{L}/u.test(p) && !/\d/.test(p));
  const primera = palabras[0];
  if (!primera) return "?";
  const ultima = palabras.length > 1 ? palabras[palabras.length - 1]! : null;
  const letras = ultima ? primera[0]! + ultima[0]! : primera.slice(0, 2);
  return letras.toLocaleUpperCase("es");
}
