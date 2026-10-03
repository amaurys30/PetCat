/**
 * Horario semanal de una sede (A6c y E2). La API guarda una lista de rangos
 * `{ dia_semana, hora_apertura, hora_cierre }` con 0 = domingo; aquí se maneja por día.
 * Varios rangos el mismo día son horario partido: no se pueden cruzar, pero sí tocar
 * (08:00–12:00 y 12:00–14:00), igual que en la API.
 */

export interface RangoApi {
  dia_semana: number;
  hora_apertura: string;
  hora_cierre: string;
}

/** Horas "HH:MM". */
export interface Rango {
  apertura: string;
  cierre: string;
}

/** Siete días, índice = dia_semana de la API (0 = domingo). */
export type Semana = Rango[][];

export const NOMBRES_DIA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

/** Orden de la semana en pantalla: lunes primero. */
export const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0] as const;

export const semanaVacia = (): Semana => Array.from({ length: 7 }, () => []);

const hhmm = (hora: string) => hora.slice(0, 5);

const ordenar = (rangos: Rango[]) => [...rangos].sort((a, b) => a.apertura.localeCompare(b.apertura));

export function semanaDesdeApi(rangos: readonly RangoApi[]): Semana {
  const semana = semanaVacia();
  for (const r of rangos) {
    semana[r.dia_semana]!.push({ apertura: hhmm(r.hora_apertura), cierre: hhmm(r.hora_cierre) });
  }
  return semana.map(ordenar);
}

/**
 * Lista para `PUT /sucursales/:id/horarios`, en orden de día y hora. `posiciones[i]` dice a
 * qué día y rango corresponde el elemento i, para ubicar los errores `horarios.i` de un 422.
 */
export function semanaAApi(semana: Semana): {
  horarios: RangoApi[];
  posiciones: { dia: number; indice: number }[];
} {
  const horarios: RangoApi[] = [];
  const posiciones: { dia: number; indice: number }[] = [];
  semana.forEach((rangos, dia) => {
    rangos.forEach((r, indice) => {
      horarios.push({ dia_semana: dia, hora_apertura: r.apertura, hora_cierre: r.cierre });
      posiciones.push({ dia, indice });
    });
  });
  return { horarios, posiciones };
}

export const tieneRangos = (semana: Semana) => semana.some((rangos) => rangos.length > 0);

/** Se cruzan si se solapan; tocarse está permitido. */
export const seCruzan = (a: Rango, b: Rango) => a.apertura < b.cierre && b.apertura < a.cierre;

/** Errores por rango, con clave `${dia}-${indice}`: cierre antes de la apertura o cruces. */
export function erroresSemana(semana: Semana): Record<string, string> {
  const errores: Record<string, string> = {};
  semana.forEach((rangos, dia) => {
    rangos.forEach((r, i) => {
      if (r.cierre <= r.apertura) {
        errores[`${dia}-${i}`] = "La hora de cierre debe ser posterior a la de apertura";
        return;
      }
      const otro = rangos.find((o, j) => j !== i && seCruzan(r, o));
      if (otro) errores[`${dia}-${i}`] = `Se cruza con ${otro.apertura}–${otro.cierre}`;
    });
  });
  return errores;
}

export const textoRango = (r: Rango) => `${r.apertura}–${r.cierre}`;

export const textoRangos = (rangos: readonly Rango[]) =>
  rangos.length === 0 ? "Cerrado" : rangos.map(textoRango).join(" · ");

const mismosRangos = (a: readonly Rango[], b: readonly Rango[]) => textoRangos(a) === textoRangos(b);

/**
 * Días seguidos (de lunes a domingo) con el mismo horario, para mostrarlos juntos:
 * "Lunes a viernes 08:00–12:00 · 14:00–18:00", "Sábado y domingo Cerrado".
 */
export function agruparDias(semana: Semana): { dias: string; horario: string }[] {
  const grupos: { dias: number[]; rangos: Rango[] }[] = [];
  for (const dia of ORDEN_DIAS) {
    const rangos = semana[dia]!;
    const ultimo = grupos.at(-1);
    if (ultimo && mismosRangos(ultimo.rangos, rangos)) ultimo.dias.push(dia);
    else grupos.push({ dias: [dia], rangos });
  }
  return grupos.map(({ dias, rangos }) => {
    const primero = NOMBRES_DIA[dias[0]!]!;
    const ultimo = NOMBRES_DIA[dias.at(-1)!]!.toLowerCase();
    const texto =
      dias.length === 1 ? primero : dias.length === 2 ? `${primero} y ${ultimo}` : `${primero} a ${ultimo}`;
    return { dias: texto, horario: textoRangos(rangos) };
  });
}

const semanaCon = (dias: readonly number[], rangos: Rango[]): Semana =>
  semanaVacia().map((_, dia) => (dias.includes(dia) ? rangos.map((r) => ({ ...r })) : []));

export const PLANTILLAS: { id: string; etiqueta: string; semana: () => Semana }[] = [
  {
    id: "lv-partido",
    etiqueta: "L–V 8–12 y 14–18",
    semana: () =>
      semanaCon(
        [1, 2, 3, 4, 5],
        [
          { apertura: "08:00", cierre: "12:00" },
          { apertura: "14:00", cierre: "18:00" },
        ],
      ),
  },
  {
    id: "ls-corrido",
    etiqueta: "L–S 8–18",
    semana: () => semanaCon([1, 2, 3, 4, 5, 6], [{ apertura: "08:00", cierre: "18:00" }]),
  },
];

/** Horas cada 15 minutos para los selectores; la API acepta hasta 23:59. */
export const HORAS = [
  ...Array.from(
    { length: 96 },
    (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`,
  ),
  "23:59",
];

/** Un rango nuevo que no se cruce: después del último del día, o 08:00–12:00 si no hay. */
export function rangoSiguiente(rangos: readonly Rango[]): Rango | null {
  const ultimo = ordenar([...rangos]).at(-1);
  if (!ultimo) return { apertura: "08:00", cierre: "12:00" };
  const inicio = HORAS.indexOf(ultimo.cierre);
  if (inicio < 0 || inicio >= HORAS.length - 1) return null;
  const apertura = HORAS[inicio + 4] ?? HORAS[inicio + 1]!;
  const cierre = HORAS[HORAS.indexOf(apertura) + 16] ?? "23:59";
  return apertura < cierre ? { apertura, cierre } : null;
}

export const semanasIguales = (a: Semana, b: Semana) =>
  a.every((rangos, dia) => mismosRangos(ordenar(rangos), ordenar(b[dia]!)));
