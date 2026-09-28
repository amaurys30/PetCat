/**
 * Estado de las vacunas de una mascota, sin acceso a la base.
 * - Las dosis se agrupan por nombre sin distinguir mayúsculas, tildes ni espacios.
 * - Solo la dosis más reciente de cada vacuna (por fecha_aplicacion, luego id) está
 *   vigente; las anteriores son `no_aplica` (no quedan "vencidas" para siempre).
 * - La vigente: `vencido` si fecha_proxima < hoy; `proximo` si fecha_proxima cae en los
 *   próximos `diasAviso` días; `al_dia` en otro caso (también sin fecha_proxima).
 */

/** "  Antirrábica " -> "antirrabica". */
export const normalizarNombre = (nombre) =>
  nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const sumarDias = (fechaISO, dias) => {
  const fecha = new Date(`${fechaISO}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
};

/** Días de `desde` a `hasta` ("YYYY-MM-DD"). */
export const diasEntre = (desde, hasta) =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);

/**
 * @param {{ id_vacuna, nombre_vacuna, fecha_aplicacion, fecha_proxima }[]} vacunas Todas las de la mascota
 * @param {string} hoy "YYYY-MM-DD"
 * @param {number} diasAviso
 * @returns {Map<number, "al_dia"|"proximo"|"vencido"|"no_aplica">}
 */
export const calcularEstados = (vacunas, hoy, diasAviso) => {
  const vigentes = new Map();
  for (const v of vacunas) {
    const clave = normalizarNombre(v.nombre_vacuna);
    const actual = vigentes.get(clave);
    const masReciente =
      !actual ||
      v.fecha_aplicacion > actual.fecha_aplicacion ||
      (v.fecha_aplicacion === actual.fecha_aplicacion && v.id_vacuna > actual.id_vacuna);
    if (masReciente) vigentes.set(clave, v);
  }
  const limite = sumarDias(hoy, diasAviso);
  const estados = new Map();
  for (const v of vacunas) {
    if (vigentes.get(normalizarNombre(v.nombre_vacuna)) !== v) estados.set(v.id_vacuna, "no_aplica");
    else if (!v.fecha_proxima) estados.set(v.id_vacuna, "al_dia");
    else if (v.fecha_proxima < hoy) estados.set(v.id_vacuna, "vencido");
    else if (v.fecha_proxima <= limite) estados.set(v.id_vacuna, "proximo");
    else estados.set(v.id_vacuna, "al_dia");
  }
  return estados;
};
