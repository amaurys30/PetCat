/**
 * Si una sede está abierta ahora, según su horario semanal (`horarios_negocio`) en la hora de
 * Bogotá (la del proceso, ver env.js). Los bloqueos y vacaciones son de cada empleado, no de
 * la sede: no cambian si la sede está abierta. Los festivos de Colombia no se consideran
 * (pendiente en docs/PLAN.md). Un rango no cruza la medianoche (hora_cierre > hora_apertura).
 */

const dosDigitos = (n) => String(n).padStart(2, "0");

/** Día (0 = domingo) y hora "HH:MM:SS" de `ahora` en Bogotá. */
export const momento = (ahora = new Date()) => ({
  dia_semana: ahora.getDay(),
  hora: `${dosDigitos(ahora.getHours())}:${dosDigitos(ahora.getMinutes())}:${dosDigitos(ahora.getSeconds())}`,
});

/** "8:00" o "08:00:00" -> "08:00:00", para comparar como texto. */
const normalizar = (hora) => {
  const [h, m = "00", s = "00"] = String(hora).split(":");
  return `${dosDigitos(Number(h))}:${dosDigitos(Number(m))}:${dosDigitos(Number(s))}`;
};

/** "HH:MM" para la respuesta. */
const hhmm = (hora) => hora.slice(0, 5);

/** Rangos del día ordenados, con los que se tocan o se solapan unidos (08-12 y 12-18 -> 08-18). */
const unir = (rangos) => {
  const ordenados = rangos
    .map((r) => ({ apertura: normalizar(r.hora_apertura), cierre: normalizar(r.hora_cierre) }))
    .sort((a, b) => a.apertura.localeCompare(b.apertura));
  const unidos = [];
  for (const r of ordenados) {
    const ultimo = unidos.at(-1);
    if (ultimo && r.apertura <= ultimo.cierre) {
      if (r.cierre > ultimo.cierre) ultimo.cierre = r.cierre;
    } else {
      unidos.push({ ...r });
    }
  }
  return unidos;
};

/**
 * Estado de una sede con los rangos de HOY (`dia_semana` del momento): abierta (y a qué hora
 * cierra el tramo actual) o cerrada (y, si abre más tarde hoy, a qué hora).
 * @param {{ hora_apertura: string, hora_cierre: string }[]} rangosDeHoy
 * @param {string} hora "HH:MM:SS" de ahora
 */
export const estadoApertura = (rangosDeHoy, hora) => {
  const unidos = unir(rangosDeHoy);
  const actual = unidos.find((r) => r.apertura <= hora && hora < r.cierre);
  if (actual) return { abierto_ahora: true, cierra_a: hhmm(actual.cierre), abre_hoy_a: null };
  const siguiente = unidos.find((r) => r.apertura > hora);
  return { abierto_ahora: false, cierra_a: null, abre_hoy_a: siguiente ? hhmm(siguiente.apertura) : null };
};
