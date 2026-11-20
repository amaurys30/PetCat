import type { Especie, EventoSalud, PuntoPeso, ResumenMascota, Sexo } from "@/api/types";

import { parsearFechaApi } from "./fechas";
import { formatearFecha } from "./formatos";

// Textos y cálculos de las pantallas de mascotas, sin React (se prueban como funciones puras).

export const ESPECIES: { valor: Especie; etiqueta: string }[] = [
  { valor: "perro", etiqueta: "Perro" },
  { valor: "gato", etiqueta: "Gato" },
  { valor: "conejo", etiqueta: "Conejo" },
  { valor: "ave", etiqueta: "Ave" },
  { valor: "reptil", etiqueta: "Reptil" },
  { valor: "roedor", etiqueta: "Roedor" },
  { valor: "pez", etiqueta: "Pez" },
  { valor: "otro", etiqueta: "Otro animal" },
];

export const nombreEspecie = (especie: string) =>
  ESPECIES.find((e) => e.valor === especie)?.etiqueta ?? "Mascota";

export const SEXOS: { valor: Sexo; etiqueta: string }[] = [
  { valor: "macho", etiqueta: "Macho" },
  { valor: "hembra", etiqueta: "Hembra" },
  { valor: "desconocido", etiqueta: "No sé" },
];

export const nombreSexo = (sexo: string) =>
  sexo === "macho" ? "Macho" : sexo === "hembra" ? "Hembra" : "Sexo sin registrar";

/** Concordancia con el sexo: "Esterilizado"/"Esterilizada", "Fallecido"/"Fallecida". */
export const segunSexo = (sexo: string, masculino: string, femenino: string) =>
  sexo === "hembra" ? femenino : masculino;

/** "3 años", "1 año", "8 meses", "1 mes", "Menos de 1 mes"; null sin fecha de nacimiento. */
export function formatearEdad(meses: number | null | undefined): string | null {
  if (meses === null || meses === undefined) return null;
  if (meses < 1) return "Menos de 1 mes";
  if (meses < 12) return meses === 1 ? "1 mes" : `${meses} meses`;
  const anios = Math.floor(meses / 12);
  return anios === 1 ? "1 año" : `${anios} años`;
}

/** 28.4 → "28,4 kg"; 3 → "3 kg"; 0.25 → "0,25 kg". */
export function formatearPeso(peso: number | null | undefined): string | null {
  if (peso === null || peso === undefined) return null;
  return `${String(Math.round(peso * 100) / 100).replace(".", ",")} kg`;
}

const formatearKg = (kg: number) => String(Math.round(Math.abs(kg) * 10) / 10).replace(".", ",");

/** Meses enteros entre dos fechas de la API (redondeado; mínimo 0). */
function mesesEntre(desde: string, hasta: string) {
  const a = parsearFechaApi(desde);
  const b = parsearFechaApi(hasta);
  return Math.max(0, Math.round((b.anio - a.anio) * 12 + (b.mes - a.mes) + (b.dia - a.dia) / 30));
}

const plazo = (meses: number) => (meses <= 0 ? "en menos de un mes" : meses === 1 ? "en 1 mes" : `en ${meses} meses`);

/**
 * Descripción en texto del gráfico de peso (el gráfico es decorativo para el lector):
 * "Subió 0,6 kg en 3 meses, de 27,8 a 28,4 kg. Último registro: jue 12 nov."
 */
export function describirPeso(puntos: PuntoPeso[]): { titulo: string | null; descripcion: string } {
  if (puntos.length === 0) return { titulo: null, descripcion: "Sin registros de peso todavía." };
  const ultimo = puntos[puntos.length - 1]!;
  const ultimoTexto = `Último registro: ${formatearFecha(ultimo.fecha)}.`;
  if (puntos.length === 1) {
    return { titulo: null, descripcion: `${formatearPeso(ultimo.peso)}. ${ultimoTexto}` };
  }
  const primero = puntos[0]!;
  const diferencia = Math.round((ultimo.peso - primero.peso) * 10) / 10;
  const meses = mesesEntre(primero.fecha, ultimo.fecha);
  const rango = `de ${formatearKg(primero.peso)} a ${formatearKg(ultimo.peso)} kg`;
  const titulo =
    diferencia === 0
      ? `Estable ${plazo(meses)}`
      : `${diferencia > 0 ? "Subió" : "Bajó"} ${formatearKg(diferencia)} kg ${plazo(meses)}`;
  return { titulo, descripcion: `${titulo}, ${rango}. ${ultimoTexto}` };
}

/** Estado de salud en texto (nunca solo color). */
export function textoEstadoSalud(estado: ResumenMascota["estado_vacunas"]): string | null {
  switch (estado) {
    case "al_dia":
      return "Salud al día";
    case "proximo":
      return "Vacuna próxima";
    case "vencido":
      return "Vacuna vencida";
    case "sin_vacunas":
      return "Sin vacunas registradas";
    default:
      return null;
  }
}

/** "Hoy", "Mañana", "En 20 días", "Venció ayer", "Venció hace 3 días". */
export function textoPlazo(dias: number): string {
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  if (dias > 1) return `En ${dias} días`;
  if (dias === -1) return "Venció ayer";
  return `Venció hace ${-dias} días`;
}

/** Título del recordatorio: "Vacuna: Antirrábica", "Desparasitación", "Control en Clínica A". */
export function tituloEvento(evento: EventoSalud): string {
  if (evento.tipo === "vacuna") return `Vacuna: ${evento.titulo}`;
  if (evento.tipo === "control" && evento.negocio) return `Control en ${evento.negocio.nombre}`;
  return evento.titulo;
}
