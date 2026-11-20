import type { HorarioRango, NegocioBusqueda, ServicioNegocio, SucursalCercana } from "@/api/types";
import { partesEnBogota } from "@/lib/fechas";
import { formatearDinero, formatearHora } from "@/lib/formatos";

import type { CategoriaPin, Coordenada, Pin } from "./mapa/protocolo";

// Lógica de Explorar (M10) y del perfil del negocio (M11), sin React: se prueba aparte.

/** Centro del mapa sin la ubicación del teléfono: Sincelejo (Parque Santander). */
export const CENTRO_SINCELEJO: Coordenada = { lat: 9.3047, lng: -75.3978 };

const NOMBRE_TIPO: Record<string, string> = {
  veterinaria: "Veterinaria",
  clinica: "Clínica veterinaria",
  peluqueria_canina: "Peluquería canina",
  tienda_mascotas: "Tienda de mascotas",
  guarderia: "Guardería",
  entrenador: "Entrenador",
  multiservicio: "Multiservicio",
};

export const nombreTipo = (tipo: string) => NOMBRE_TIPO[tipo] ?? "Negocio";

export function categoriaDe(tipo: string): CategoriaPin {
  if (tipo === "veterinaria" || tipo === "clinica") return "veterinaria";
  if (tipo === "peluqueria_canina") return "peluqueria";
  if (tipo === "tienda_mascotas") return "tienda";
  return "otro";
}

// ─── Filtros ────────────────────────────────────────────────────────────────

export type Filtros = { abiertoAhora: boolean; veterinarias: boolean; peluqueria: boolean };

/** Tipos para la API: Veterinarias agrupa veterinaria y clínica. Sin ninguno, todos. */
export function tiposDeFiltros({ veterinarias, peluqueria }: Filtros): string[] {
  return [...(veterinarias ? ["veterinaria", "clinica"] : []), ...(peluqueria ? ["peluqueria_canina"] : [])];
}

// ─── Textos ─────────────────────────────────────────────────────────────────

/** 4.9 -> "4,9"; 5 -> "5,0". */
export const formatearCalificacion = (valor: number) => valor.toFixed(1).replace(".", ",");

/** Texto del pin: la calificación, o "Nuevo" si aún no tiene reseñas. */
export const etiquetaPin = (n: Pick<NegocioBusqueda, "calificacion_promedio" | "total_resenas">) =>
  n.total_resenas > 0 ? formatearCalificacion(n.calificacion_promedio) : "Nuevo";

/** 0.35 -> "350 m"; 1.234 -> "1,2 km"; 12.6 -> "13 km". */
export function formatearDistancia(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}

type Apertura = Pick<SucursalCercana, "abierto_ahora" | "cierra_a" | "abre_hoy_a">;

/** "Abierto hasta 7:00 p. m.", "Cerrado · abre a las 2:00 p. m." o "Cerrado". */
export function textoApertura(a: Apertura): string {
  if (a.abierto_ahora) return a.cierra_a ? `Abierto hasta ${formatearHora(a.cierra_a)}` : "Abierto";
  return a.abre_hoy_a ? `Cerrado · abre a las ${formatearHora(a.abre_hoy_a)}` : "Cerrado";
}

/** Cierra la frase con punto, sin duplicarlo ("7:00 p. m." ya termina en punto). */
export const conPunto = (texto: string) => (texto.endsWith(".") ? texto : `${texto}.`);

/**
 * Todo el negocio en una frase para el lector: "Clínica Vet Sabanas, Veterinaria. 4,9 estrellas,
 * 128 reseñas. A 1,2 km. Abierto hasta 7:00 p. m."
 */
export function etiquetaNegocio(n: NegocioBusqueda, conDistancia: boolean): string {
  const partes = [`${n.nombre}, ${nombreTipo(n.tipo)}.`];
  partes.push(
    n.total_resenas > 0
      ? `${formatearCalificacion(n.calificacion_promedio)} estrellas, ${n.total_resenas} ${n.total_resenas === 1 ? "reseña" : "reseñas"}.`
      : "Sin reseñas todavía.",
  );
  if (conDistancia && n.distancia_km !== null) partes.push(`A ${formatearDistancia(n.distancia_km)}.`);
  if (n.sucursal_cercana) partes.push(conPunto(textoApertura(n.sucursal_cercana)));
  return partes.join(" ");
}

// ─── Pines y cómo llegar ────────────────────────────────────────────────────

/** Pines del mapa: solo los negocios con coordenadas (la API las trae en la sucursal cercana). */
export function pinesDe(negocios: NegocioBusqueda[]): Pin[] {
  return negocios.flatMap((n) =>
    n.sucursal_cercana
      ? [
          {
            id: n.id_negocio,
            lat: n.sucursal_cercana.latitud,
            lng: n.sucursal_cercana.longitud,
            categoria: categoriaDe(n.tipo),
            etiqueta: etiquetaPin(n),
          },
        ]
      : [],
  );
}

/** Enlaces web de Google Maps y Waze: abren la app si está instalada, si no el navegador. */
export function enlacesComoLlegar({ lat, lng }: Coordenada): { google: string; waze: string } {
  const punto = `${lat},${lng}`;
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(punto)}`,
    waze: `https://waze.com/ul?ll=${encodeURIComponent(punto)}&navigate=yes`,
  };
}

/** Distancia en km entre dos puntos (fórmula del haversine). */
export function distanciaKm(a: Coordenada, b: Coordenada): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// ─── Horario (perfil) ───────────────────────────────────────────────────────

const normalizar = (hora: string) => {
  const [h = "0", m = "00", s = "00"] = hora.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`;
};

/** Rangos de un día, ordenados y con los que se tocan unidos (igual que la API). */
export function unirRangos(rangos: Pick<HorarioRango, "hora_apertura" | "hora_cierre">[]) {
  const ordenados = rangos
    .map((r) => ({ apertura: normalizar(r.hora_apertura), cierre: normalizar(r.hora_cierre) }))
    .sort((a, b) => a.apertura.localeCompare(b.apertura));
  const unidos: { apertura: string; cierre: string }[] = [];
  for (const r of ordenados) {
    const ultimo = unidos.at(-1);
    if (ultimo && r.apertura <= ultimo.cierre) {
      if (r.cierre > ultimo.cierre) ultimo.cierre = r.cierre;
    } else unidos.push({ ...r });
  }
  return unidos;
}

/**
 * Si la sede está abierta en `ahora` (hora de Bogotá), con su horario semanal: la misma regla
 * que la API en la búsqueda (sin festivos de Colombia).
 */
export function aperturaDeSede(horarios: HorarioRango[], ahora: Date = new Date()): Apertura {
  const { hora, minuto, diaSemana } = partesEnBogota(ahora);
  // Al minuto basta para abierto o cerrado.
  const actual = `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}:00`;
  const hoy = unirRangos(horarios.filter((h) => h.dia_semana === diaSemana));
  const abierto = hoy.find((r) => r.apertura <= actual && actual < r.cierre);
  if (abierto) return { abierto_ahora: true, cierra_a: abierto.cierre.slice(0, 5), abre_hoy_a: null };
  const siguiente = hoy.find((r) => r.apertura > actual);
  return {
    abierto_ahora: false,
    cierra_a: null,
    abre_hoy_a: siguiente ? siguiente.apertura.slice(0, 5) : null,
  };
}

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
/** De lunes a domingo, como se lee un horario en Colombia. */
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

/** "Lunes" -> "8:00 a. m. a 12:00 p. m. y 2:00 p. m. a 6:00 p. m." (o "Cerrado"), de lunes a domingo. */
export function horarioSemanal(horarios: HorarioRango[]): { dia: string; texto: string }[] {
  return ORDEN_DIAS.map((d) => {
    const rangos = unirRangos(horarios.filter((h) => h.dia_semana === d));
    return {
      dia: DIAS[d]!,
      texto: rangos.length
        ? rangos.map((r) => `${formatearHora(r.apertura)} a ${formatearHora(r.cierre)}`).join(" y ")
        : "Cerrado",
    };
  });
}

// ─── Precios ────────────────────────────────────────────────────────────────

/** "$45.000", "$45.000 a $60.000", "Desde $45.000", "$20.000 por hora". */
export function textoPrecio(
  s: Pick<ServicioNegocio, "precio_actual" | "precio_maximo" | "tipo_precio">,
): string {
  const precio = formatearDinero(s.precio_actual);
  if (s.tipo_precio === "por_hora") return `${precio} por hora`;
  if (s.tipo_precio === "por_dia") return `${precio} por día`;
  if (s.tipo_precio === "variable")
    return s.precio_maximo ? `${precio} a ${formatearDinero(s.precio_maximo)}` : `Desde ${precio}`;
  return precio;
}

/** El menor precio actual de los servicios (para "Desde $38.000"), o null sin servicios. */
export function precioDesde(servicios: Pick<ServicioNegocio, "precio_actual">[]): number | null {
  return servicios.length ? Math.min(...servicios.map((s) => s.precio_actual)) : null;
}

/** "45 min", "1 h", "1 h 30 min". */
export function textoDuracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
