/**
 * Fechas en la zona del proceso (America/Bogota, la fija env.js), como las
 * guarda MySQL con dateStrings: "YYYY-MM-DD".
 */
const dosDigitos = (n) => String(n).padStart(2, "0");

/** Fecha de hoy en Bogotá. Los "YYYY-MM-DD" se comparan bien como texto. */
export const hoyISO = (ahora = new Date()) =>
  `${ahora.getFullYear()}-${dosDigitos(ahora.getMonth() + 1)}-${dosDigitos(ahora.getDate())}`;

/** Días de `desde` a `hasta` ("YYYY-MM-DD"); negativo si `hasta` es anterior. */
export const diasEntre = (desde, hasta) =>
  Math.round((new Date(`${hasta}T12:00:00`) - new Date(`${desde}T12:00:00`)) / 86_400_000);

/** "YYYY-MM-DD HH:MM:SS" (DATETIME de MySQL, hora de Bogotá) -> Date. */
export const deDatetimeSQL = (texto) => new Date(String(texto).replace(" ", "T"));

/** Fecha y hora en Bogotá como DATETIME de MySQL: "YYYY-MM-DD HH:MM:SS". */
export const aDatetimeSQL = (fecha) =>
  `${hoyISO(fecha)} ${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}:${dosDigitos(fecha.getSeconds())}`;
