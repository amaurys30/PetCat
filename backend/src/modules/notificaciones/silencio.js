/**
 * Horario de silencio de push y correos (hora de Bogotá: la del proceso). Funciones
 * puras sobre `{ inicio, fin }` en minutos del día; el rango puede cruzar la
 * medianoche (21:00–07:00). Inicio igual a fin = sin silencio.
 */

const POR_DEFECTO = { inicio: 21 * 60, fin: 7 * 60 };
// Una cancelación o reprogramación es urgente si la cita empieza antes de este margen tras el silencio.
export const MARGEN_URGENTE_MIN = 3 * 60;

/** "21:00" -> 1260. null si no es una hora válida. */
const aMinutos = (hhmm) => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm ?? ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Configuración a partir de los valores de configuracion_global (con los de por defecto si son inválidos). */
export const silencioDe = ({ inicio, fin }) => {
  const i = aMinutos(inicio);
  const f = aMinutos(fin);
  return i === null || f === null ? POR_DEFECTO : { inicio: i, fin: f };
};

export const enSilencio = (ahora, { inicio, fin }) => {
  if (inicio === fin) return false;
  const m = ahora.getHours() * 60 + ahora.getMinutes();
  return inicio < fin ? m >= inicio && m < fin : m >= inicio || m < fin;
};

/** Próximo momento en que termina el silencio (la próxima hora `fin`). */
export const finDelSilencio = (ahora, { fin }) => {
  const d = new Date(ahora);
  d.setHours(Math.floor(fin / 60), fin % 60, 0, 0);
  if (d <= ahora) d.setDate(d.getDate() + 1);
  return d;
};

/**
 * Cuándo enviar una push o un correo creado `ahora`: de inmediato fuera del silencio o
 * si es urgente; si no, al terminar el silencio. `esUrgente(fin)` recibe el fin del
 * silencio (una cita que empieza antes de fin + 3 h no puede esperar).
 */
export const programarEnvio = (ahora, silencio, esUrgente = () => false) => {
  if (!enSilencio(ahora, silencio)) return ahora;
  const fin = finDelSilencio(ahora, silencio);
  return esUrgente(fin) ? ahora : fin;
};

/** "2026-10-12" + "08:30:00" -> Date (hora de Bogotá). */
export const inicioDeCita = (fecha, hora) => new Date(`${fecha}T${String(hora).slice(0, 5)}:00`);

/** La cita (o alguna de las citas) empieza antes del fin del silencio + 3 horas. */
export const citaCercana = (fin, ...inicios) => {
  const limite = fin.getTime() + MARGEN_URGENTE_MIN * 60_000;
  return inicios.some((inicio) => inicio && inicio.getTime() < limite);
};
