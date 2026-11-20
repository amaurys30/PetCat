import type { MascotaConResumen, RegistroHistorial, Vacuna } from "@/api/types";
import { hoyEnBogota, parsearFechaApi } from "@/lib/fechas";
import { formatearFecha } from "@/lib/formatos";
import { nombreEspecie } from "@/lib/mascotas";

// Lógica del Pasaporte PetCat (M7) y de la línea de vida (M8), sin React: se prueba aparte.

/** Días de aviso: una dosis o desparasitación que vence dentro de este plazo está "próxima" (igual que la API). */
export const DIAS_AVISO = 30;

/** Días de `desde` a `hasta` (fechas de la API, AAAA-MM-DD). */
export function diasEntre(desde: string, hasta: string): number {
  const a = parsearFechaApi(desde);
  const b = parsearFechaApi(hasta);
  return Math.round((Date.UTC(b.anio, b.mes - 1, b.dia) - Date.UTC(a.anio, a.mes - 1, a.dia)) / 86_400_000);
}

// ─── Número de pasaporte y microchip ───────────────────────────────────────

/** "PC-7KQ4-M9XR" → "P C, 7 K Q 4, M 9 X R": el lector lo deletrea por grupos. */
export function codigoParaLector(codigo: string): string {
  return codigo
    .split("-")
    .map((grupo) => grupo.split("").join(" "))
    .join(", ");
}

/** "985141000123456" → "985 141 000 123 456" (para ver y para el lector, que lee cada bloque). */
export function microchipEnGrupos(microchip: string): string {
  const limpio = microchip.replace(/\s+/g, "");
  return /^\d+$/.test(limpio) ? (limpio.match(/\d{1,3}/g) ?? []).join(" ") : microchip.trim();
}

const sinTildes = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
const aMrz = (texto: string) =>
  sinTildes(texto)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "<")
    .replace(/^<+|<+$/g, "");

export const LARGO_MRZ = 44;

/** Línea tipo pasaporte (decorativa, oculta al lector): PC<COL<MAX<<GOLDEN<<<…<985141000123456. */
export function lineaMrz(m: Pick<MascotaConResumen, "nombre" | "raza" | "especie" | "microchip">): string {
  const partes = `PC<COL<${aMrz(m.nombre)}<<${aMrz(m.raza ?? nombreEspecie(m.especie))}`;
  const chip = m.microchip ? aMrz(m.microchip) : "";
  // El microchip va completo al final; si no cabe todo, se recorta el nombre o la raza.
  const inicio = partes.slice(0, Math.max(0, LARGO_MRZ - chip.length - 2));
  return `${inicio}${"<".repeat(LARGO_MRZ - inicio.length - chip.length)}${chip}`;
}

// ─── Sellos ─────────────────────────────────────────────────────────────────

export type EstadoSello = "aplicada" | "proxima" | "vencida";
/** Color del sello (decorativo): el estado siempre va también en texto. */
export type TonoSello = "teal" | "coral" | "lavender" | "info" | "sun" | "danger" | "memoria";

export type Sello = {
  clave: string;
  nombre: string;
  tipo: "vacuna" | "desparasitacion";
  estado: EstadoSello;
  fecha_aplicacion: string;
  fecha_proxima: string | null;
  /** Quién la registró: el nombre de la veterinaria o el dueño. */
  origen: { veterinaria: string } | "dueno" | null;
  tono: TonoSello;
};

const TONOS_APLICADA: TonoSello[] = ["teal", "coral", "lavender", "info"];

const ESTADO_DE_VACUNA: Record<string, EstadoSello> = {
  al_dia: "aplicada",
  proximo: "proxima",
  vencido: "vencida",
};

const tonoPorEstado = (estado: EstadoSello, indice: number, fallecido: boolean): TonoSello => {
  if (fallecido) return "memoria";
  if (estado === "vencida") return "danger";
  if (estado === "proxima") return "sun";
  return TONOS_APLICADA[indice % TONOS_APLICADA.length]!;
};

/** Estado de una fecha de próxima dosis respecto a hoy, con la misma regla que la API. */
export function estadoPorProxima(fecha_proxima: string | null, hoy: string): EstadoSello {
  if (!fecha_proxima) return "aplicada";
  const dias = diasEntre(hoy, fecha_proxima);
  if (dias < 0) return "vencida";
  return dias <= DIAS_AVISO ? "proxima" : "aplicada";
}

/**
 * Un sello por vacuna (su dosis vigente: las anteriores llegan como `no_aplica`) y uno por la
 * última desparasitación. Mascota «En memoria»: todos como historial aplicado, sin alertas.
 */
export function construirSellos(
  vacunas: Vacuna[],
  desparasitacion: RegistroHistorial | null,
  { fallecido = false, hoy = hoyEnBogota() }: { fallecido?: boolean; hoy?: string } = {},
): Sello[] {
  const sellos: Sello[] = vacunas
    .filter((v) => v.estado !== "no_aplica")
    .map((v, i) => {
      const estado = fallecido ? "aplicada" : (ESTADO_DE_VACUNA[v.estado] ?? "aplicada");
      return {
        clave: `vacuna-${v.id_vacuna}`,
        nombre: v.nombre_vacuna,
        tipo: "vacuna",
        estado,
        fecha_aplicacion: v.fecha_aplicacion,
        fecha_proxima: v.fecha_proxima,
        origen:
          v.registrada_por === "negocio" ? { veterinaria: v.negocio?.nombre ?? "una veterinaria" } : "dueno",
        tono: tonoPorEstado(estado, i, fallecido),
      };
    });
  if (desparasitacion) {
    const estado = fallecido ? "aplicada" : estadoPorProxima(desparasitacion.proximo_control, hoy);
    sellos.push({
      clave: `desparasitacion-${desparasitacion.id_historial}`,
      nombre: "Desparasitación",
      tipo: "desparasitacion",
      estado,
      fecha_aplicacion: desparasitacion.fecha,
      fecha_proxima: desparasitacion.proximo_control,
      origen: desparasitacion.negocio ? { veterinaria: desparasitacion.negocio.nombre } : null,
      tono: fallecido ? "memoria" : estado === "aplicada" ? "info" : tonoPorEstado(estado, 0, false),
    });
  }
  return sellos;
}

/** Fecha del sello: "12·12·24" (decorativa; el lector recibe la fecha completa). */
export function fechaSello(fecha: string): string {
  const { anio, mes, dia } = parsearFechaApi(fecha);
  return `${String(dia).padStart(2, "0")}·${String(mes).padStart(2, "0")}·${String(anio).slice(-2)}`;
}

const TEXTO_ESTADO: Record<EstadoSello, string> = {
  aplicada: "Aplicada",
  proxima: "Próxima",
  vencida: "Vencida",
};

/** Texto del estado dentro del sello: "Vence 12 dic", "Venció 12 dic" o la fecha de aplicación. */
export function textoSello(s: Sello): string {
  if (s.estado === "proxima" && s.fecha_proxima)
    return `Vence ${formatearFecha(s.fecha_proxima).replace(/^\S+ /, "")}`;
  if (s.estado === "vencida" && s.fecha_proxima)
    return `Venció ${formatearFecha(s.fecha_proxima).replace(/^\S+ /, "")}`;
  return fechaSello(s.fecha_aplicacion);
}

/** "Rabia. Aplicada el 12 dic 2024. Próxima dosis el 12 dic 2025. Registrada por Clínica Patitas." */
export function etiquetaSello(s: Sello): string {
  const partes = [`${s.nombre}. ${TEXTO_ESTADO[s.estado]}`];
  partes[0] += s.estado === "aplicada" ? ` el ${formatearFecha(s.fecha_aplicacion, { anio: true })}.` : ".";
  if (s.estado !== "aplicada")
    partes.push(`Aplicada el ${formatearFecha(s.fecha_aplicacion, { anio: true })}.`);
  if (s.fecha_proxima) {
    const verbo = s.estado === "vencida" ? "Venció" : s.tipo === "vacuna" ? "Próxima dosis el" : "Próxima el";
    partes.push(
      `${verbo} ${s.estado === "vencida" ? "el " : ""}${formatearFecha(s.fecha_proxima, { anio: true })}.`,
    );
  }
  if (s.origen === "dueno") partes.push("Registrada por ti.");
  else if (s.origen) partes.push(`Registrada por ${s.origen.veterinaria}.`);
  return partes.join(" ");
}

// ─── Anillo de vacunas ──────────────────────────────────────────────────────

export type Anillo = {
  /** Vacunas vigentes que no están vencidas. */
  alDia: number;
  total: number;
  tono: "ok" | "aviso" | "alerta";
  titulo: string;
  detalle: string | null;
};

/**
 * "6 de 6 vacunas al día" (no "esquema completo": la app no conoce el esquema de cada especie).
 * Próxima: el refuerzo más cercano. Con vencidas, cuál y desde cuándo.
 */
export function construirAnillo(vacunas: Vacuna[], hoy = hoyEnBogota()): Anillo | null {
  const vigentes = vacunas.filter((v) => v.estado !== "no_aplica");
  if (vigentes.length === 0) return null;
  const vencidas = vigentes
    .filter((v) => v.estado === "vencido")
    .sort((a, b) => (a.fecha_proxima ?? "").localeCompare(b.fecha_proxima ?? ""));
  const proximas = vigentes.filter((v) => v.estado === "proximo");
  const total = vigentes.length;
  const alDia = total - vencidas.length;
  const titulo = `${alDia} de ${total} ${total === 1 ? "vacuna al día" : "vacunas al día"}`;

  if (vencidas.length > 0) {
    const v = vencidas[0]!;
    const otras = vencidas.length - 1;
    return {
      alDia,
      total,
      tono: "alerta",
      titulo,
      detalle: `${v.nombre_vacuna} venció el ${formatearFecha(v.fecha_proxima!).replace(/^\S+ /, "")}${otras > 0 ? ` (y ${otras} más)` : ""}`,
    };
  }
  const siguiente = vigentes
    .filter((v) => v.fecha_proxima && v.fecha_proxima >= hoy)
    .sort((a, b) => a.fecha_proxima!.localeCompare(b.fecha_proxima!))[0];
  return {
    alDia,
    total,
    tono: proximas.length > 0 ? "aviso" : "ok",
    titulo,
    detalle: siguiente
      ? `Próximo refuerzo: ${siguiente.nombre_vacuna} · ${formatearFecha(siguiente.fecha_proxima!).replace(/^\S+ /, "")}`
      : null,
  };
}

// ─── Tarjeta ────────────────────────────────────────────────────────────────

/** "Perro · Golden" o la especie sola. */
export const especieYRaza = (m: Pick<MascotaConResumen, "especie" | "raza">) =>
  [nombreEspecie(m.especie), m.raza].filter(Boolean).join(" · ");

/**
 * Toda la tarjeta en una frase para el lector: "Pasaporte PetCat de Max. Número P C, 7 K Q 4, M 9 X R.
 * Perro, Golden. Nació el 8 mar 2022. Microchip 985 141 000 123 456. Vacunas: 6 de 6 al día."
 */
export function etiquetaTarjeta(m: MascotaConResumen, anillo: Anillo | null): string {
  const partes = [`Pasaporte PetCat de ${m.nombre}.`, `Número ${codigoParaLector(m.codigo_pasaporte)}.`];
  partes.push(`${[nombreEspecie(m.especie), m.raza].filter(Boolean).join(", ")}.`);
  if (m.fecha_nacimiento) partes.push(`Nació el ${formatearFecha(m.fecha_nacimiento, { anio: true })}.`);
  partes.push(m.microchip ? `Microchip ${microchipEnGrupos(m.microchip)}.` : "Sin microchip registrado.");
  if (m.fallecido) {
    partes.push(
      m.fecha_fallecimiento
        ? `En memoria, desde el ${formatearFecha(m.fecha_fallecimiento, { anio: true })}.`
        : "En memoria.",
    );
  } else if (anillo) {
    partes.push(`Vacunas: ${anillo.alDia} de ${anillo.total} al día.`);
  } else {
    partes.push("Sin vacunas registradas.");
  }
  return partes.join(" ");
}

// ─── Línea de vida ──────────────────────────────────────────────────────────

export type FiltroLinea = "todo" | "vacunas" | "desparasitacion" | "consultas";

export const TIPOS_CONSULTA = [
  "consulta_general",
  "control",
  "cirugia",
  "examen_laboratorio",
  "radiografia",
  "ecografia",
  "hospitalizacion",
  "urgencia",
  "otro",
] as const;

/** Tipos del historial que pide cada filtro (Vacunas no usa el historial). */
export const TIPOS_POR_FILTRO: Record<FiltroLinea, readonly string[] | null> = {
  todo: [],
  vacunas: null,
  desparasitacion: ["desparasitacion"],
  consultas: TIPOS_CONSULTA,
};

const TITULO_TIPO: Record<string, string> = {
  consulta_general: "Consulta general",
  control: "Control",
  cirugia: "Cirugía",
  vacunacion: "Vacunación",
  examen_laboratorio: "Examen de laboratorio",
  radiografia: "Radiografía",
  ecografia: "Ecografía",
  hospitalizacion: "Hospitalización",
  urgencia: "Urgencia",
  desparasitacion: "Desparasitación",
  otro: "Otro registro",
};

export type ItemLinea = {
  clave: string;
  clase: "vacuna" | "desparasitacion" | "consulta";
  fecha: string;
  titulo: string;
  /** Una línea: veterinaria · profesional · lote o producto · peso. */
  detalle: string;
  estado: "Aplicada" | "Atendida";
  /** Al expandir (solo registros del historial). */
  extra: { etiqueta: string; valor: string }[];
};

export type FilaLinea = { tipo: "anio"; anio: string } | { tipo: "item"; item: ItemLinea };

const profesional = (e: { nombre: string; apellido: string } | null | undefined) =>
  e ? `${e.nombre} ${e.apellido}` : null;
const kg = (peso: number | null | undefined) =>
  peso === null || peso === undefined ? null : `Peso ${String(peso).replace(".", ",")} kg`;

function itemDeVacuna(v: Vacuna): ItemLinea {
  return {
    clave: `vacuna-${v.id_vacuna}`,
    clase: "vacuna",
    fecha: v.fecha_aplicacion,
    titulo: v.nombre_vacuna,
    detalle: [
      v.lote ? `Lote ${v.lote}` : null,
      v.registrada_por === "negocio" ? (v.negocio?.nombre ?? null) : "Registrada por ti",
      profesional(v.empleado),
      v.dosis,
    ]
      .filter(Boolean)
      .join(" · "),
    estado: "Aplicada",
    extra: [],
  };
}

function itemDeRegistro(r: RegistroHistorial): ItemLinea {
  const esDesparasitacion = r.tipo === "desparasitacion";
  const extra = [
    { etiqueta: "Motivo", valor: r.motivo_consulta },
    { etiqueta: "Diagnóstico", valor: r.diagnostico },
    { etiqueta: "Tratamiento", valor: r.tratamiento },
    { etiqueta: esDesparasitacion ? "Producto" : "Medicamentos", valor: r.medicamentos_prescritos },
    { etiqueta: "Indicaciones", valor: r.indicaciones },
    {
      etiqueta: esDesparasitacion ? "Próxima" : "Próximo control",
      valor: r.proximo_control ? formatearFecha(r.proximo_control, { anio: true }) : null,
    },
  ].filter((e): e is { etiqueta: string; valor: string } => !!e.valor);
  return {
    clave: `historial-${r.id_historial}`,
    clase: esDesparasitacion ? "desparasitacion" : "consulta",
    fecha: r.fecha,
    titulo: TITULO_TIPO[r.tipo] ?? "Registro",
    detalle: [
      r.negocio?.nombre,
      profesional(r.empleado),
      esDesparasitacion ? r.medicamentos_prescritos : null,
      kg(r.peso_registro),
    ]
      .filter(Boolean)
      .join(" · "),
    estado: esDesparasitacion ? "Aplicada" : "Atendida",
    extra,
  };
}

/**
 * Filas de la línea de vida, del más reciente al más antiguo, con un separador por año.
 * - Vacunas: completas (no paginadas). Historial: las páginas cargadas.
 * - Un registro `vacunacion` que una vacuna enlaza (`id_historial_medico`) no se repite: se ve la vacuna.
 * - Con páginas pendientes, solo las vacunas hasta la fecha del registro más antiguo cargado,
 *   para que nada se reordene al cargar más.
 */
export function construirLinea({
  filtro,
  vacunas,
  registros,
  hayMas,
}: {
  filtro: FiltroLinea;
  vacunas: Vacuna[];
  registros: RegistroHistorial[];
  hayMas: boolean;
}): FilaLinea[] {
  const enlazados = new Set(
    vacunas.map((v) => v.id_historial_medico).filter((id): id is number => id !== null),
  );
  const items: ItemLinea[] = [];

  if (filtro !== "vacunas") {
    for (const r of registros)
      if (!(r.tipo === "vacunacion" && enlazados.has(r.id_historial))) items.push(itemDeRegistro(r));
  }
  if (filtro === "todo" || filtro === "vacunas") {
    const masAntigua = filtro === "todo" && hayMas ? registros.at(-1)?.fecha : undefined;
    for (const v of vacunas) if (!masAntigua || v.fecha_aplicacion >= masAntigua) items.push(itemDeVacuna(v));
  }

  items.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.clave.localeCompare(b.clave));

  const filas: FilaLinea[] = [];
  let anio = "";
  for (const item of items) {
    const del = item.fecha.slice(0, 4);
    if (del !== anio) {
      anio = del;
      filas.push({ tipo: "anio", anio });
    }
    filas.push({ tipo: "item", item });
  }
  return filas;
}

/** Texto del registro para el lector: fecha, título, estado y detalle. */
export function etiquetaItem(i: ItemLinea): string {
  return [
    `${formatearFecha(i.fecha, { anio: true })}. ${i.titulo}. ${i.estado}.`,
    i.detalle ? `${i.detalle}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}
