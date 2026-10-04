import { seCruzan } from "./horarios";

/**
 * Horario semanal de un profesional (D5). Como el de una sede, pero cada rango puede ser de
 * una sede (`id_sucursal`) o de cualquiera (null). Los rangos de un mismo día no se cruzan
 * aunque sean de sedes distintas (la persona no puede estar en dos sitios); pueden tocarse.
 */

export interface RangoProfesional {
  inicio: string;
  fin: string;
  id_sucursal: number | null;
}

/** Siete días, índice = dia_semana de la API (0 = domingo). */
export type SemanaProfesional = RangoProfesional[][];

interface RangoApi {
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  id_sucursal?: number | null;
}

const hhmm = (hora: string) => hora.slice(0, 5);
const ordenar = (rangos: RangoProfesional[]) => [...rangos].sort((a, b) => a.inicio.localeCompare(b.inicio));

export const semanaProfesionalVacia = (): SemanaProfesional => Array.from({ length: 7 }, () => []);

export function semanaProfesionalDesdeApi(rangos: readonly RangoApi[]): SemanaProfesional {
  const semana = semanaProfesionalVacia();
  for (const r of rangos) {
    semana[r.dia_semana]!.push({
      inicio: hhmm(r.hora_inicio),
      fin: hhmm(r.hora_fin),
      id_sucursal: r.id_sucursal ?? null,
    });
  }
  return semana.map(ordenar);
}

/** Lista para el PUT y la posición (día, índice) de cada elemento, para ubicar los 422 `horarios.N`. */
export function semanaProfesionalAApi(semana: SemanaProfesional) {
  const horarios: Required<RangoApi>[] = [];
  const posiciones: { dia: number; indice: number }[] = [];
  semana.forEach((rangos, dia) => {
    rangos.forEach((r, indice) => {
      horarios.push({ dia_semana: dia, hora_inicio: r.inicio, hora_fin: r.fin, id_sucursal: r.id_sucursal });
      posiciones.push({ dia, indice });
    });
  });
  return { horarios, posiciones };
}

const comoRango = (r: RangoProfesional) => ({ apertura: r.inicio, cierre: r.fin });

/** Errores por rango (`${dia}-${indice}`): fin antes del inicio o cruce con otro rango del día. */
export function erroresSemanaProfesional(semana: SemanaProfesional): Record<string, string> {
  const errores: Record<string, string> = {};
  semana.forEach((rangos, dia) => {
    rangos.forEach((r, i) => {
      if (r.fin <= r.inicio) {
        errores[`${dia}-${i}`] = "La hora de fin debe ser posterior a la de inicio";
        return;
      }
      const otro = rangos.find((o, j) => j !== i && seCruzan(comoRango(r), comoRango(o)));
      if (otro) errores[`${dia}-${i}`] = `Se cruza con ${otro.inicio}–${otro.fin}`;
    });
  });
  return errores;
}

const clave = (rangos: readonly RangoProfesional[]) =>
  ordenar([...rangos])
    .map((r) => `${r.inicio}-${r.fin}@${r.id_sucursal ?? "*"}`)
    .join(",");

export const semanasProfesionalIguales = (a: SemanaProfesional, b: SemanaProfesional) =>
  a.every((rangos, dia) => clave(rangos) === clave(b[dia]!));

/** El horario de una sede como punto de partida del profesional (rangos de esa sede). */
export function semanaDesdeSede(
  horarios: readonly { dia_semana: number; hora_apertura: string; hora_cierre: string }[],
  idSucursal: number,
): SemanaProfesional {
  return semanaProfesionalDesdeApi(
    horarios.map((h) => ({
      dia_semana: h.dia_semana,
      hora_inicio: h.hora_apertura,
      hora_fin: h.hora_cierre,
      id_sucursal: idSucursal,
    })),
  );
}
