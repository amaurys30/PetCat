/**
 * Fechas en la zona del proceso (America/Bogota, la fija env.js), como las
 * guarda MySQL con dateStrings: "YYYY-MM-DD".
 */
const dosDigitos = (n) => String(n).padStart(2, "0");

/** Fecha de hoy en Bogotá. Los "YYYY-MM-DD" se comparan bien como texto. */
export const hoyISO = (ahora = new Date()) =>
  `${ahora.getFullYear()}-${dosDigitos(ahora.getMonth() + 1)}-${dosDigitos(ahora.getDate())}`;
