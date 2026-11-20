import { ApiError } from "@/api/errors";
import type { Cita, EstadoCita, HorarioLibre, HorarioRango } from "@/api/types";
import { DESFASE_BOGOTA_MS, parsearFechaApi, parsearHoraApi } from "@/lib/fechas";
import { formatearFecha, formatearHora } from "@/lib/formatos";

// Lógica pura de las citas (M5): días para agendar, franjas, estados y reglas de la app.

const dos = (n: number) => String(n).padStart(2, "0");

const MESES_LARGOS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** `YYYY-MM-DD` más `dias` días (sin zona horaria: es una fecha de calendario). */
export function sumarDias(fecha: string, dias: number): string {
  const { anio, mes, dia } = parsearFechaApi(fecha);
  const d = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`;
}

export type DiaAgenda = { fecha: string; diaSemana: number; dia: number; mes: number; abierto: boolean };

/** Los próximos `cantidad` días desde hoy; `abierto`: la sede tiene horario ese día de la semana. */
export function diasParaAgendar(hoy: string, horarios: HorarioRango[], cantidad = 14): DiaAgenda[] {
  return Array.from({ length: cantidad }, (_, i) => {
    const fecha = sumarDias(hoy, i);
    const { diaSemana, dia, mes } = parsearFechaApi(fecha);
    return { fecha, diaSemana, dia, mes, abierto: horarios.some((h) => h.dia_semana === diaSemana) };
  });
}

/** "martes 18 de noviembre" para lectores de pantalla. */
export function fechaParaLeer(fecha: string): string {
  const { diaSemana, dia, mes } = parsearFechaApi(fecha);
  return `${DIAS_LARGOS[diaSemana]} ${dia} de ${MESES_LARGOS[mes - 1]!.toLowerCase()}`;
}

export type GrupoHorarios = { titulo: "Mañana" | "Tarde" | "Noche"; horarios: HorarioLibre[] };

/** Mañana (antes de las 12), tarde (12 a 6) y noche (desde las 6); sin grupos vacíos. */
export function agruparHorarios(horarios: HorarioLibre[]): GrupoHorarios[] {
  const grupos: GrupoHorarios[] = [
    { titulo: "Mañana", horarios: [] },
    { titulo: "Tarde", horarios: [] },
    { titulo: "Noche", horarios: [] },
  ];
  for (const h of horarios) {
    const { hora } = parsearHoraApi(h.hora_inicio);
    grupos[hora < 12 ? 0 : hora < 18 ? 1 : 2]!.horarios.push(h);
  }
  return grupos.filter((g) => g.horarios.length > 0);
}

/** "8:30" (sin a. m./p. m.: el grupo Mañana o Tarde ya lo dice). */
export const horaCorta = (hora: string) => formatearHora(hora).replace(/ [ap]\. m\.$/, "");

const PLURAL_ESPECIE: Record<string, string> = {
  perro: "perros",
  gato: "gatos",
  conejo: "conejos",
  ave: "aves",
  reptil: "reptiles",
  roedor: "roedores",
  pez: "peces",
};

/**
 * Si el servicio atiende a la mascota por especie: null si sí; si no, el motivo en texto.
 * El peso lo comprueba la API al reservar (el perfil del negocio no lo trae).
 */
export function motivoNoAtiende(especie: string, tipoMascota: string[]): string | null {
  if (tipoMascota.length === 0 || tipoMascota.includes("todos") || tipoMascota.includes(especie)) return null;
  return `Este servicio no atiende ${PLURAL_ESPECIE[especie] ?? "esta especie"}`;
}

const ESTADOS: Record<EstadoCita, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  en_curso: "En curso",
  completada: "Completada",
  cancelada: "Cancelada",
  no_asistio: "No asististe",
  reprogramada: "Reprogramada",
};
export const textoEstado = (estado: EstadoCita) => ESTADOS[estado] ?? estado;

/** Instante (ms) en que empieza la cita: fecha y hora de Bogotá, sin depender de la zona del teléfono. */
export function inicioCita(cita: Pick<Cita, "fecha" | "hora_inicio">): number {
  const { anio, mes, dia } = parsearFechaApi(cita.fecha);
  const { hora, minuto } = parsearHoraApi(cita.hora_inicio);
  return Date.UTC(anio, mes - 1, dia, hora, minuto) - DESFASE_BOGOTA_MS;
}

/** Horas de anticipación para cancelar sin que sea tardía y para reprogramar (reglas de la API). */
export const HORAS_AVISO = 2;
const AVISO_MS = HORAS_AVISO * 60 * 60 * 1000;

type CitaRegla = Pick<Cita, "estado" | "fecha" | "hora_inicio">;
const activa = (c: CitaRegla) => c.estado === "pendiente" || c.estado === "confirmada";

/** El dueño puede cancelar mientras la cita no haya empezado. */
export const puedeCancelar = (c: CitaRegla, ahora = Date.now()) => activa(c) && inicioCita(c) > ahora;
/** Con menos de 2 horas de anticipación la cancelación queda como tardía. */
export const cancelacionTardia = (c: CitaRegla, ahora = Date.now()) => inicioCita(c) - ahora < AVISO_MS;
/** El dueño reprograma hasta 2 horas antes. */
export const puedeReprogramar = (c: CitaRegla, ahora = Date.now()) =>
  activa(c) && inicioCita(c) - ahora >= AVISO_MS;

/** Lunes de la semana de una fecha (las semanas en Colombia empiezan el lunes). */
const lunesDe = (fecha: string) => sumarDias(fecha, -((parsearFechaApi(fecha).diaSemana + 6) % 7));

/** "Esta semana" o el mes ("Diciembre", con el año si no es el actual). */
export function grupoDeCita(fecha: string, hoy: string): string {
  if (lunesDe(fecha) === lunesDe(hoy)) return "Esta semana";
  const { anio, mes } = parsearFechaApi(fecha);
  const nombre = MESES_LARGOS[mes - 1]!;
  return anio === parsearFechaApi(hoy).anio ? nombre : `${nombre} ${anio}`;
}

/** Agrupa en el orden en que llegan (la API ya las ordena). */
export function agruparCitas(citas: Cita[], hoy: string): { titulo: string; citas: Cita[] }[] {
  const grupos: { titulo: string; citas: Cita[] }[] = [];
  for (const c of citas) {
    const titulo = grupoDeCita(c.fecha, hoy);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.titulo === titulo) ultimo.citas.push(c);
    else grupos.push({ titulo, citas: [c] });
  }
  return grupos;
}

/** "Mar 18 nov · 8:30 a. m." */
export const fechaYHora = (fecha: string, hora: string) =>
  `${capitalizar(formatearFecha(fecha))} · ${formatearHora(hora)}`;

/** Todo lo de la cita en una frase para el lector de pantalla. */
export function etiquetaCita(c: Cita): string {
  return [
    `${c.servicio.nombre} para ${c.mascota.nombre}`,
    `${fechaParaLeer(c.fecha)} a las ${formatearHora(c.hora_inicio)}`,
    c.sucursal ? `en ${c.negocio.nombre}, ${c.sucursal.nombre}` : `en ${c.negocio.nombre}`,
    textoEstado(c.estado),
  ]
    .map((t) => (t.endsWith(".") ? t : `${t}.`))
    .join(" ");
}

export type ErrorReserva = { mensaje: string; recargarHoras: boolean; campoMascota: boolean };

/**
 * Qué mostrar si falla reservar o reprogramar. 409: el horario se ocupó (u otro conflicto que
 * explica la API): se recargan las horas. 422 de la mascota: junto a la mascota. Sin respuesta:
 * no sabemos si la cita quedó; no se reintenta sola para no duplicarla.
 */
export function errorDeReserva(error: unknown): ErrorReserva {
  const e = error instanceof ApiError ? error : null;
  if (e?.status === 409) {
    const ocupado = /ya no está disponible/i.test(e.message);
    return {
      mensaje: ocupado ? "Esa hora se acaba de ocupar. Elige otra de las horas libres." : e.message,
      recargarHoras: true,
      campoMascota: false,
    };
  }
  if (e?.status === 422 && typeof e.errors.id_mascota === "string") {
    return { mensaje: e.errors.id_mascota, recargarHoras: false, campoMascota: true };
  }
  if (!e || e.sinConexion) {
    return {
      mensaje:
        "No pudimos confirmar si la cita quedó agendada. Revisa Mis citas antes de intentarlo de nuevo.",
      recargarHoras: false,
      campoMascota: false,
    };
  }
  return { mensaje: e.message, recargarHoras: false, campoMascota: false };
}
