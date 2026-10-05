import { z } from "zod";
import type { CrearServicioBody, Dia, Especie, Servicio, TipoPrecio } from "@/api/servicios";
import { DIAS, ESPECIES } from "./textos";

/**
 * D2 · Formulario de servicio. Las cantidades van como texto (un campo vacío es "sin dato")
 * y se validan con las mismas reglas de la API (servicio.schemas.js y servicio.service.js).
 */
export interface ServicioValores {
  nombre: string;
  id_categoria: number;
  descripcion: string;
  tipo_mascota: Especie[];
  peso_min_kg: string;
  peso_max_kg: string;
  precio_base: string;
  precio_maximo: string;
  tipo_precio: TipoPrecio;
  duracion_minutos: string;
  margen_minutos: string;
  max_citas_dia: string;
  en_oferta: boolean;
  precio_oferta: string;
  fecha_inicio_oferta: string;
  fecha_fin_oferta: string;
  requiere_cita: boolean;
  visible_app: boolean;
  dias_disponible: Dia[];
  empleados: number[];
  indicaciones_previas: string;
}

/** Campos del formulario con el mismo nombre que en la API (para los 422 por campo). */
export const CAMPOS_SERVICIO = [
  "nombre",
  "id_categoria",
  "descripcion",
  "tipo_mascota",
  "peso_min_kg",
  "peso_max_kg",
  "precio_base",
  "precio_maximo",
  "tipo_precio",
  "duracion_minutos",
  "margen_minutos",
  "max_citas_dia",
  "en_oferta",
  "precio_oferta",
  "fecha_inicio_oferta",
  "fecha_fin_oferta",
  "requiere_cita",
  "visible_app",
  "dias_disponible",
  "empleados",
  "indicaciones_previas",
] as const satisfies readonly (keyof ServicioValores)[];

export const MAX_INDICACIONES = 500;
const MAX_DINERO = 9_999_999_999;

const texto = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export const valoresDe = (s: Servicio | null): ServicioValores => ({
  nombre: s?.nombre ?? "",
  id_categoria: s?.categoria.id_categoria ?? 0,
  descripcion: s?.descripcion ?? "",
  tipo_mascota: (s?.tipo_mascota as Especie[] | undefined) ?? ["todos"],
  peso_min_kg: texto(s?.peso_min_kg),
  peso_max_kg: texto(s?.peso_max_kg),
  precio_base: texto(s?.precio_base),
  precio_maximo: texto(s?.precio_maximo),
  tipo_precio: (s?.tipo_precio as TipoPrecio | undefined) ?? "fijo",
  duracion_minutos: texto(s?.duracion_minutos ?? 30),
  margen_minutos: texto(s?.margen_minutos ?? 0),
  max_citas_dia: texto(s?.max_citas_dia),
  en_oferta: s?.en_oferta ?? false,
  precio_oferta: texto(s?.precio_oferta),
  fecha_inicio_oferta: s?.fecha_inicio_oferta ?? "",
  fecha_fin_oferta: s?.fecha_fin_oferta ?? "",
  requiere_cita: s?.requiere_cita ?? true,
  visible_app: s?.visible_app ?? true,
  dias_disponible: (s?.dias_disponible as Dia[] | null | undefined) ?? DIAS.map((d) => d.valor),
  empleados: s?.empleados.map((e) => e.id_empleado) ?? [],
  indicaciones_previas: s?.indicaciones_previas ?? "",
});

/** "45000", "12,5" o "" -> número o null (vacío). NaN si no es un número. */
export const numero = (v: string): number | null =>
  v.trim() === "" ? null : Number(v.trim().replace(",", "."));

type Oferta = Pick<
  ServicioValores,
  "en_oferta" | "precio_oferta" | "fecha_inicio_oferta" | "fecha_fin_oferta"
>;

/**
 * Se crea la oferta o se cambia alguno de sus campos. Igual que la API: una oferta vencida
 * que no se toca no impide guardar lo demás.
 */
export const tocaOferta = (v: Oferta, inicial: Oferta | null) =>
  !inicial ||
  v.en_oferta !== inicial.en_oferta ||
  numero(v.precio_oferta) !== numero(inicial.precio_oferta) ||
  v.fecha_inicio_oferta !== inicial.fecha_inicio_oferta ||
  v.fecha_fin_oferta !== inicial.fecha_fin_oferta;

/** `inicial`: la oferta guardada (null al crear). `hoy`: "YYYY-MM-DD" de Bogotá. */
export function servicioSchema({ hoy, inicial }: { hoy: string; inicial: Oferta | null }) {
  return z
    .object({
      nombre: z.string().trim().min(2, "Debe tener al menos 2 caracteres").max(150, "Máximo 150 caracteres"),
      id_categoria: z.number().int().positive("Elige una categoría"),
      descripcion: z.string().trim().max(2000, "Máximo 2000 caracteres"),
      tipo_mascota: z.array(z.string()).min(1, "Elige al menos una especie"),
      peso_min_kg: z.string(),
      peso_max_kg: z.string(),
      precio_base: z.string(),
      precio_maximo: z.string(),
      tipo_precio: z.enum(["fijo", "por_hora", "por_dia", "variable"]),
      duracion_minutos: z.string(),
      margen_minutos: z.string(),
      max_citas_dia: z.string(),
      en_oferta: z.boolean(),
      precio_oferta: z.string(),
      fecha_inicio_oferta: z.string(),
      fecha_fin_oferta: z.string(),
      requiere_cita: z.boolean(),
      visible_app: z.boolean(),
      dias_disponible: z.array(z.string()).min(1, "Elige al menos un día"),
      empleados: z.array(z.number().int()),
      indicaciones_previas: z
        .string()
        .trim()
        .max(MAX_INDICACIONES, `Máximo ${MAX_INDICACIONES} caracteres`)
        .refine((v) => !/[\r\n]/.test(v), "Escríbelas en un solo párrafo, sin saltos de línea"),
    })
    .superRefine((v, ctx) => {
      const error = (path: keyof ServicioValores, message: string) =>
        ctx.addIssue({ code: "custom", path: [path], message });

      /** Entero dentro del rango (y múltiplo de `paso`). Devuelve el número o null. */
      const entero = (
        path: keyof ServicioValores,
        {
          min,
          max,
          paso = 1,
          obligatorio = false,
        }: { min: number; max: number; paso?: number; obligatorio?: boolean },
      ) => {
        const n = numero(v[path] as string);
        if (n === null) {
          if (obligatorio) error(path, "Obligatorio");
          return null;
        }
        if (!Number.isInteger(n)) error(path, "Debe ser un número entero");
        else if (n < min || n > max) error(path, `Debe estar entre ${min} y ${max}`);
        else if (n % paso !== 0) error(path, `Debe ser múltiplo de ${paso}`);
        else return n;
        return null;
      };

      const base = entero("precio_base", { min: 0, max: MAX_DINERO, obligatorio: true });
      const maximo = entero("precio_maximo", { min: 0, max: MAX_DINERO });
      if (base !== null && maximo !== null && maximo < base) {
        error("precio_maximo", "Debe ser mayor o igual que el precio base");
      }
      entero("duracion_minutos", { min: 5, max: 1440, paso: 5, obligatorio: true });
      entero("margen_minutos", { min: 0, max: 240, paso: 5, obligatorio: true });
      entero("max_citas_dia", { min: 1, max: 255 });

      const pesos = (["peso_min_kg", "peso_max_kg"] as const).map((path) => {
        const n = numero(v[path]);
        if (n === null) return null;
        if (Number.isNaN(n) || n <= 0 || n > 9999.99) {
          error(path, "Debe ser un peso mayor que 0");
          return null;
        }
        return n;
      });
      if (pesos[0] != null && pesos[1] != null && pesos[0] > pesos[1]) {
        error("peso_max_kg", "Debe ser mayor o igual que el peso mínimo");
      }

      if (v.tipo_mascota.includes("todos") && v.tipo_mascota.length > 1) {
        error("tipo_mascota", "«Todas» no se combina con otras especies");
      }

      if (v.en_oferta) {
        const oferta = entero("precio_oferta", { min: 0, max: MAX_DINERO });
        if (numero(v.precio_oferta) === null)
          error("precio_oferta", "Obligatorio si el servicio está en oferta");
        else if (oferta !== null && base !== null && oferta >= base) {
          error("precio_oferta", "Debe ser menor que el precio base");
        }
        const { fecha_inicio_oferta: inicio, fecha_fin_oferta: fin } = v;
        if (inicio && fin && fin < inicio) {
          error("fecha_fin_oferta", "No puede ser anterior a la fecha de inicio");
        } else if (tocaOferta(v, inicial)) {
          if (!inicio) error("fecha_inicio_oferta", "Obligatoria si el servicio está en oferta");
          if (!fin) error("fecha_fin_oferta", "Obligatoria si el servicio está en oferta");
          else if (fin < hoy) error("fecha_fin_oferta", "No puede ser anterior a hoy");
        }
      }
    });
}

const ordenEspecies = (lista: readonly string[]) =>
  lista.includes("todos")
    ? (["todos"] as Especie[])
    : ESPECIES.map((e) => e.valor).filter((e) => lista.includes(e));

/**
 * Cuerpo completo para la API. Los siete días van como null (todos los días); sin oferta,
 * el precio y las fechas de la oferta van en null. `empleados` solo si se pueden asignar.
 */
export function cuerpoDe(v: ServicioValores, { conEmpleados }: { conEmpleados: boolean }): CrearServicioBody {
  const n = (valor: string) => numero(valor);
  const vacioANull = (valor: string) => (valor.trim() === "" ? null : valor.trim());
  return {
    id_categoria: v.id_categoria,
    nombre: v.nombre.trim(),
    descripcion: vacioANull(v.descripcion),
    indicaciones_previas: vacioANull(v.indicaciones_previas),
    precio_base: n(v.precio_base) ?? 0,
    precio_maximo: n(v.precio_maximo),
    tipo_precio: v.tipo_precio,
    duracion_minutos: n(v.duracion_minutos) ?? 30,
    margen_minutos: n(v.margen_minutos) ?? 0,
    tipo_mascota: ordenEspecies(v.tipo_mascota),
    peso_min_kg: n(v.peso_min_kg),
    peso_max_kg: n(v.peso_max_kg),
    requiere_cita: v.requiere_cita,
    max_citas_dia: n(v.max_citas_dia),
    dias_disponible:
      v.dias_disponible.length === DIAS.length
        ? null
        : DIAS.map((d) => d.valor).filter((d) => v.dias_disponible.includes(d)),
    visible_app: v.visible_app,
    en_oferta: v.en_oferta,
    precio_oferta: v.en_oferta ? n(v.precio_oferta) : null,
    fecha_inicio_oferta: v.en_oferta ? v.fecha_inicio_oferta || null : null,
    fecha_fin_oferta: v.en_oferta ? v.fecha_fin_oferta || null : null,
    ...(conEmpleados && { empleados: [...v.empleados].sort((a, b) => a - b) }),
  };
}

/** Para el PATCH: solo los campos del cuerpo que cambiaron respecto al servicio guardado. */
export function cambiosDe(nuevo: CrearServicioBody, inicial: CrearServicioBody): Partial<CrearServicioBody> {
  const cambios: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(nuevo)) {
    if (JSON.stringify(valor) !== JSON.stringify((inicial as Record<string, unknown>)[clave])) {
      cambios[clave] = valor;
    }
  }
  return cambios as Partial<CrearServicioBody>;
}
