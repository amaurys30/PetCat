import {
  parsearFechaApi,
  parsearHoraApi,
  partesEnBogota,
  type FechaCalendario,
  type HoraReloj,
} from "./fechas";

// Formatos es-CO escritos a mano (sin Intl): mismo resultado en Hermes y en Node.
// Dinero `$45.000`, fecha `vie 15 nov`, hora `8:30 a. m.`.

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

/** `$45.000`: pesos sin decimales, puntos de miles. Acepta los DECIMAL que llegan como texto. */
export function formatearDinero(valor: number | string): string {
  const numero = Math.round(Number(valor));
  if (!Number.isFinite(numero)) return "";
  const miles = String(Math.abs(numero)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${numero < 0 ? "-" : ""}$${miles}`;
}

function aCalendario(fecha: string | Date): FechaCalendario {
  return typeof fecha === "string" ? parsearFechaApi(fecha) : partesEnBogota(fecha);
}

/** `vie 15 nov`; con `{ anio: true }`, `vie 15 nov 2026`. */
export function formatearFecha(fecha: string | Date, opciones: { anio?: boolean } = {}): string {
  const { anio, mes, dia, diaSemana } = aCalendario(fecha);
  const base = `${DIAS[diaSemana]} ${dia} ${MESES[mes - 1]}`;
  return opciones.anio ? `${base} ${anio}` : base;
}

function aReloj(hora: string | Date): HoraReloj {
  return typeof hora === "string" ? parsearHoraApi(hora) : partesEnBogota(hora);
}

/** `8:30 a. m.`. Mediodía es `12:00 p. m.` y medianoche `12:00 a. m.`. */
export function formatearHora(hora: string | Date): string {
  const { hora: h, minuto } = aReloj(hora);
  const sufijo = h < 12 ? "a. m." : "p. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(minuto).padStart(2, "0")} ${sufijo}`;
}
