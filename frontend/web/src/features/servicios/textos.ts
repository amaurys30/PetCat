import {
  Award,
  Bath,
  Heart,
  Hospital,
  House,
  Microscope,
  PawPrint,
  Pill,
  Scissors,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from "lucide-react";
import type { Dia, Especie, Servicio, TipoPrecio } from "@/api/servicios";
import { dinero } from "@/lib/format";

/** Especies del servicio (columna SET de la API) en el orden de los chips. "todos" va aparte. */
export const ESPECIES: { valor: Exclude<Especie, "todos">; texto: string; plural: string }[] = [
  { valor: "perro", texto: "Perro", plural: "perros" },
  { valor: "gato", texto: "Gato", plural: "gatos" },
  { valor: "conejo", texto: "Conejo", plural: "conejos" },
  { valor: "ave", texto: "Ave", plural: "aves" },
  { valor: "reptil", texto: "Reptil", plural: "reptiles" },
  { valor: "roedor", texto: "Roedor", plural: "roedores" },
];

export const DIAS: { valor: Dia; corto: string; nombre: string }[] = [
  { valor: "lunes", corto: "L", nombre: "lunes" },
  { valor: "martes", corto: "M", nombre: "martes" },
  { valor: "miercoles", corto: "X", nombre: "miércoles" },
  { valor: "jueves", corto: "J", nombre: "jueves" },
  { valor: "viernes", corto: "V", nombre: "viernes" },
  { valor: "sabado", corto: "S", nombre: "sábado" },
  { valor: "domingo", corto: "D", nombre: "domingo" },
];

export const TIPOS_PRECIO: { valor: TipoPrecio; texto: string }[] = [
  { valor: "fijo", texto: "Fijo" },
  { valor: "por_hora", texto: "Por hora" },
  { valor: "por_dia", texto: "Por día" },
  { valor: "variable", texto: "Variable" },
];

const ICONOS: Record<string, LucideIcon> = {
  stethoscope: Stethoscope,
  syringe: Syringe,
  bath: Bath,
  scissors: Scissors,
  pill: Pill,
  hospital: Hospital,
  microscope: Microscope,
  home: House,
  award: Award,
  heart: Heart,
};

/** Ícono de la categoría (`icono` de /categorias-servicio); una huella si no se conoce. */
export const iconoCategoria = (icono: string | null | undefined): LucideIcon =>
  (icono && ICONOS[icono]) || PawPrint;

const unir = (partes: string[]) =>
  partes.length <= 1 ? (partes[0] ?? "") : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;

/** "Todas las especies", "Solo perros", "Perros y gatos", "Perros, gatos y aves", "4 especies". */
export function textoEspecies(lista: readonly string[]): string {
  if (lista.length === 0 || lista.includes("todos")) return "Todas las especies";
  const plurales = ESPECIES.filter((e) => lista.includes(e.valor)).map((e) => e.plural);
  if (plurales.length === 1) return `Solo ${plurales[0]}`;
  if (plurales.length > 3) return `${plurales.length} especies`;
  const texto = unir(plurales);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "30 min", "90 min", "2 h", "2 h 30 min"; 1440 es "Todo el día". */
export function textoMinutos(minutos: number): string {
  if (minutos >= 1440) return "Todo el día";
  if (minutos < 120) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "60 min", "60 min + 15 de margen". */
export const textoDuracion = (duracion: number, margen: number) =>
  margen > 0 ? `${textoMinutos(duracion)} + ${margen} de margen` : textoMinutos(duracion);

const UNIDAD: Partial<Record<string, string>> = { por_hora: " / hora", por_dia: " / día" };

/**
 * Precio para mostrar según el tipo: "$ 45.000", "$ 45.000 / hora", "Desde $ 45.000" (variable
 * sin máximo) o "$ 45.000 – $ 60.000" (con máximo). `precio` es el que se cobra hoy.
 */
export function textoPrecio(s: {
  precio: number;
  precio_maximo: number | null;
  tipo_precio: string;
}): string {
  const unidad = UNIDAD[s.tipo_precio] ?? "";
  if (s.precio_maximo !== null && s.precio_maximo > s.precio) {
    return `${dinero(s.precio)} – ${dinero(s.precio_maximo)}${unidad}`;
  }
  if (s.tipo_precio === "variable") return `Desde ${dinero(s.precio)}`;
  return `${dinero(s.precio)}${unidad}`;
}

export type EstadoOferta = "vigente" | "programada" | "vencida" | null;

/** Estado de la oferta en `hoy` ("YYYY-MM-DD" de Bogotá). null si no está en oferta. */
export function estadoOferta(
  s: Pick<Servicio, "en_oferta" | "oferta_vigente" | "fecha_inicio_oferta" | "fecha_fin_oferta">,
  hoy: string,
): EstadoOferta {
  if (!s.en_oferta) return null;
  if (s.oferta_vigente) return "vigente";
  if (s.fecha_inicio_oferta && s.fecha_inicio_oferta > hoy) return "programada";
  if (s.fecha_fin_oferta && s.fecha_fin_oferta < hoy) return "vencida";
  return null;
}

/** Aparece en la app y se puede reservar. */
export const reservableDesdeApp = (s: Servicio) => s.activo && s.visible_app && s.reservable;

/** Activo, requiere cita y no tiene profesionales activos: no se puede reservar. */
export const sinProfesionales = (s: Servicio) => s.activo && s.requiere_cita && s.sin_empleados;

/** Texto libre con punto final, como lo arma la API en los recordatorios. */
export const conPunto = (texto: string) => (/[.!?…]$/.test(texto) ? texto : `${texto}.`);

/** Las indicaciones previas no llevan saltos de línea: el recordatorio las une en un párrafo. */
export const sinSaltos = (texto: string) => texto.replace(/\s*[\r\n]+\s*/g, " ");
