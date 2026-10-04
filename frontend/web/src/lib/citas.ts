/**
 * "1 cita está fuera de la disponibilidad", "2 citas están fuera de la disponibilidad".
 * Las `citas_afectadas` de la API incluyen también las que ya estaban fuera antes del cambio.
 */
export const textoCitasFuera = (n: number) =>
  `${n} ${n === 1 ? "cita está" : "citas están"} fuera de la disponibilidad`;
