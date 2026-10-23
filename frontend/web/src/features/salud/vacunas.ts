import { z } from "zod";
import type { CambiosVacuna, NuevaVacuna, Vacuna } from "@/api/salud";
import { hoyISO } from "@/lib/format";

/**
 * Sugerencias de C5 por especie. La API no tiene catálogo de vacunas: es una lista fija para
 * escribir más rápido, y siempre se puede escribir otra.
 */
export const SUGERENCIAS_VACUNA: Record<string, string[]> = {
  perro: [
    "Antirrábica",
    "Parvovirus",
    "Moquillo",
    "Polivalente (DHPPi)",
    "Leptospirosis",
    "Tos de las perreras",
  ],
  gato: ["Antirrábica", "Triple felina", "Leucemia felina"],
  conejo: ["Mixomatosis", "Enfermedad hemorrágica vírica"],
};
export const sugerenciasPara = (especie: string) => SUGERENCIAS_VACUNA[especie] ?? ["Antirrábica"];

/** Igual que la API (vacuna.calculo.js): sin tildes, sin mayúsculas y sin espacios de más. */
export const normalizarNombre = (nombre: string) =>
  nombre
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * La dosis vigente de la misma vacuna que quedaría "No aplica" con una aplicación en `fecha`
 * (la API deja vigente la más reciente). Undefined si no hay otra o si la nueva no es más reciente.
 */
export function dosisReemplazada(vacunas: Vacuna[], nombre: string, fecha: string, idPropia?: number) {
  const clave = normalizarNombre(nombre);
  if (!clave || !fecha) return undefined;
  return vacunas.find(
    (v) =>
      v.id_vacuna !== idPropia &&
      v.estado !== "no_aplica" &&
      normalizarNombre(v.nombre_vacuna) === clave &&
      v.fecha_aplicacion < fecha,
  );
}

const corto = (max: number) => z.string().max(max, `Máximo ${max} caracteres`);

/** Mismas reglas que la API (vacuna.schemas.js del backend). */
export const vacunaSchema = z
  .object({
    nombre: z.string().trim().min(1, "Escribe la vacuna").max(150, "Máximo 150 caracteres"),
    enfermedad: corto(150),
    fechaAplicacion: z
      .string()
      .min(1, "Elige la fecha de aplicación")
      .refine((f) => f <= hoyISO(), "No puede ser una fecha futura"),
    fechaProxima: z.string(),
    lote: corto(60),
    laboratorio: corto(100),
    dosis: corto(60),
    via: corto(60),
    sitio: corto(60),
    idEmpleado: z.string(),
    idHistorial: z.string(),
    notas: corto(300),
  })
  .refine((v) => !v.fechaProxima || v.fechaProxima > v.fechaAplicacion, {
    path: ["fechaProxima"],
    message: "Debe ser posterior a la fecha de aplicación",
  });

export type VacunaValores = z.infer<typeof vacunaSchema>;

export const CAMPO_DE_API_VACUNA: Record<string, keyof VacunaValores> = {
  nombre_vacuna: "nombre",
  enfermedad_objetivo: "enfermedad",
  fecha_aplicacion: "fechaAplicacion",
  fecha_proxima: "fechaProxima",
  lote: "lote",
  laboratorio: "laboratorio",
  dosis: "dosis",
  via_administracion: "via",
  sitio_aplicacion: "sitio",
  id_empleado: "idEmpleado",
  id_historial_medico: "idHistorial",
  notas: "notas",
};

const v = (x: string | null | undefined) => x ?? "";

export function valoresDeVacuna(vacuna: Vacuna): VacunaValores {
  return {
    nombre: vacuna.nombre_vacuna,
    enfermedad: v(vacuna.enfermedad_objetivo),
    fechaAplicacion: vacuna.fecha_aplicacion,
    fechaProxima: v(vacuna.fecha_proxima),
    lote: v(vacuna.lote),
    laboratorio: v(vacuna.laboratorio),
    dosis: v(vacuna.dosis),
    via: v(vacuna.via_administracion),
    sitio: v(vacuna.sitio_aplicacion),
    idEmpleado: vacuna.empleado ? String(vacuna.empleado.id_empleado) : "",
    idHistorial: vacuna.id_historial_medico ? String(vacuna.id_historial_medico) : "",
    notas: v(vacuna.notas),
  };
}

const nulo = (x: string) => (x.trim() === "" ? null : x.trim());

function camposApi(x: VacunaValores) {
  return {
    nombre_vacuna: x.nombre.trim(),
    enfermedad_objetivo: nulo(x.enfermedad),
    fecha_aplicacion: x.fechaAplicacion,
    fecha_proxima: nulo(x.fechaProxima),
    lote: nulo(x.lote),
    laboratorio: nulo(x.laboratorio),
    dosis: nulo(x.dosis),
    via_administracion: nulo(x.via),
    sitio_aplicacion: nulo(x.sitio),
    id_empleado: x.idEmpleado ? Number(x.idEmpleado) : null,
    id_historial_medico: x.idHistorial ? Number(x.idHistorial) : null,
    notas: nulo(x.notas),
  };
}

/** Nueva vacuna sin los campos vacíos (sin profesional, la API pone el perfil de quien registra). */
export function nuevaVacunaApi(x: VacunaValores, idMascota: number): NuevaVacuna {
  const campos = Object.fromEntries(Object.entries(camposApi(x)).filter(([, valor]) => valor !== null));
  return { ...campos, id_mascota: idMascota } as NuevaVacuna;
}

/** Edición: solo lo que cambió (vaciar un campo lo envía en null). */
export function cambiosVacunaApi(x: VacunaValores, original: VacunaValores): CambiosVacuna {
  const nuevos = camposApi(x);
  const antes = camposApi(original);
  return Object.fromEntries(
    Object.entries(nuevos).filter(([campo, valor]) => antes[campo as keyof typeof antes] !== valor),
  ) as CambiosVacuna;
}
