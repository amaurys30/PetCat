/**
 * Horarios libres para un servicio, sin acceso a la base. Rangos en minutos
 * desde la medianoche con fin exclusivo, como en disponibilidad.calculo.js.
 *
 * - Los horarios candidatos son siempre de la cuadrícula (`intervalo`, alineada
 *   a la medianoche: :00, :15, :30, :45 con 15).
 * - La cita [t, t + duración] debe caber entera en un rango disponible.
 * - Para no cruzarse con otras citas cuenta el margen: la nueva ocupa
 *   [t, t + duración + margen] y cada existente [inicio, fin + su margen]. El
 *   margen no necesita caber en la disponibilidad (la limpieza puede ser después del cierre).
 */

/** Primer múltiplo de `intervalo` mayor o igual que `minuto`. */
export const alCuadricula = (minuto, intervalo) => Math.ceil(minuto / intervalo) * intervalo;

/**
 * Inicios libres de un empleado.
 * @param {object} datos
 * @param {{ inicio, fin }[]} datos.rangos Disponibilidad del empleado ese día
 * @param {{ inicio, fin }[]} datos.ocupados Citas del empleado, con su margen ya sumado al fin
 * @param {number} datos.duracion Minutos del servicio
 * @param {number} datos.margen Margen del servicio (minutos)
 * @param {number} datos.intervalo Cuadrícula (minutos)
 * @param {number} [datos.desde] Primer minuto permitido (antelación de hoy); 0 por defecto
 * @returns {number[]} Minutos de inicio, ordenados
 */
export const iniciosLibres = ({ rangos, ocupados, duracion, margen, intervalo, desde = 0 }) => {
  const inicios = [];
  for (const rango of rangos) {
    for (let t = alCuadricula(Math.max(rango.inicio, desde), intervalo); t + duracion <= rango.fin; t += intervalo) {
      const finOcupado = t + duracion + margen;
      if (!ocupados.some((o) => o.inicio < finOcupado && t < o.fin)) inicios.push(t);
    }
  }
  return inicios;
};

/**
 * Combina los inicios libres de varios empleados: un horario por inicio con los
 * empleados que pueden atenderlo (en el orden recibido).
 * @param {{ empleado: object, inicios: number[] }[]} porEmpleado
 * @param {number} duracion
 * @returns {{ inicio: number, fin: number, empleados: object[] }[]}
 */
export const combinarHorarios = (porEmpleado, duracion) => {
  const porInicio = new Map();
  for (const { empleado, inicios } of porEmpleado) {
    for (const inicio of inicios) {
      if (!porInicio.has(inicio)) porInicio.set(inicio, []);
      porInicio.get(inicio).push(empleado);
    }
  }
  return [...porInicio.entries()]
    .sort(([a], [b]) => a - b)
    .map(([inicio, empleados]) => ({ inicio, fin: inicio + duracion, empleados }));
};
