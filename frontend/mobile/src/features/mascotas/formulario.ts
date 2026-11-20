import { z } from "zod";

import type { CambiosMascota, DatosMascota, Especie, Mascota, Sexo } from "@/api/types";
import { esFutura, fechaApiAMascara, mascaraAFechaApi } from "@/lib/fechaMascara";

// Formulario de mascota (agregar y editar) con las mismas reglas que la API
// (backend/src/modules/mascotas/mascota.schemas.js). Los campos son texto mientras se escriben;
// `aDatos` y `aCambios` los convierten al cuerpo de la petición.

const ESPECIES = ["perro", "gato", "conejo", "ave", "reptil", "roedor", "pez", "otro"] as const;
const SEXOS = ["macho", "hembra", "desconocido"] as const;

const texto = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`);

/** Peso en kg con coma o punto: "28,4" → 28.4. Vacío → null. */
export const leerPeso = (valor: string): number | null => {
  const limpio = valor.trim().replace(",", ".");
  return limpio === "" ? null : Number(limpio);
};

export const mascotaSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe su nombre").max(80, "Máximo 80 caracteres"),
  especie: z.enum(ESPECIES, { error: "Elige qué animal es" }),
  raza: texto(100),
  fecha_nacimiento: z
    .string()
    .trim()
    .refine((v) => v === "" || mascaraAFechaApi(v) !== null, "Escribe una fecha real, como 15/03/2021")
    .refine((v) => {
      const fecha = mascaraAFechaApi(v);
      return !fecha || !esFutura(fecha);
    }, "No puede ser una fecha futura"),
  sexo: z.enum(SEXOS),
  peso: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{1,4}([.,]\d{1,2})?$/.test(v), "Escribe el peso en kilos, como 28,4")
    .refine((v) => {
      const peso = leerPeso(v);
      return peso === null || (peso > 0 && peso <= 9999.99);
    }, "El peso debe ser mayor que 0"),
  color: texto(100),
  microchip: texto(50),
  numero_registro: texto(60),
  tipo_sangre: texto(10),
  esterilizado: z.boolean(),
  tiene_alergias: z.boolean(),
  alergias_detalle: texto(2000),
  condiciones_medicas: texto(2000),
  compartir_historial: z.boolean(),
});

export type MascotaForm = z.infer<typeof mascotaSchema>;

/** Campos del paso 1 de "Nueva mascota" (se validan antes de pasar al 2). */
export const CAMPOS_PASO_1 = ["especie", "nombre", "raza", "fecha_nacimiento", "sexo"] as const;

export const VACIO: MascotaForm = {
  nombre: "",
  especie: undefined as unknown as Especie,
  raza: "",
  fecha_nacimiento: "",
  sexo: "desconocido",
  peso: "",
  color: "",
  microchip: "",
  numero_registro: "",
  tipo_sangre: "",
  esterilizado: false,
  tiene_alergias: false,
  alergias_detalle: "",
  condiciones_medicas: "",
  // Por defecto la API comparte el historial con los negocios donde tiene cita.
  compartir_historial: true,
};

/** Valores del formulario a partir de la mascota (editar). */
export function desdeMascota(m: Mascota): MascotaForm {
  return {
    nombre: m.nombre,
    especie: m.especie as Especie,
    raza: m.raza ?? "",
    fecha_nacimiento: fechaApiAMascara(m.fecha_nacimiento),
    sexo: m.sexo as Sexo,
    peso: m.peso === null ? "" : String(m.peso).replace(".", ","),
    color: m.color ?? "",
    microchip: m.microchip ?? "",
    numero_registro: m.numero_registro ?? "",
    tipo_sangre: m.tipo_sangre ?? "",
    esterilizado: m.esterilizado,
    tiene_alergias: m.tiene_alergias,
    alergias_detalle: m.alergias_detalle ?? "",
    condiciones_medicas: m.condiciones_medicas ?? "",
    compartir_historial: m.compartir_historial,
  };
}

const OPCIONALES = ["raza", "color", "microchip", "numero_registro", "tipo_sangre", "condiciones_medicas"] as const;

/** Valor de un campo para la API: los textos vacíos son null; la fecha y el peso se convierten. */
function valorApi(form: MascotaForm, campo: keyof MascotaForm) {
  if (campo === "fecha_nacimiento") return mascaraAFechaApi(form.fecha_nacimiento);
  if (campo === "peso") return leerPeso(form.peso);
  if (campo === "alergias_detalle") return form.tiene_alergias && form.alergias_detalle ? form.alergias_detalle : null;
  const valor = form[campo];
  return typeof valor === "string" ? valor.trim() || null : valor;
}

/** Crear: solo los campos con valor (la API pone los valores por defecto). */
export function aDatos(form: MascotaForm): DatosMascota {
  const datos: Record<string, unknown> = {
    nombre: form.nombre.trim(),
    especie: form.especie,
    sexo: form.sexo,
    esterilizado: form.esterilizado,
    tiene_alergias: form.tiene_alergias,
    compartir_historial: form.compartir_historial,
  };
  for (const campo of [...OPCIONALES, "fecha_nacimiento", "peso", "alergias_detalle"] as const) {
    const valor = valorApi(form, campo);
    if (valor !== null) datos[campo] = valor;
  }
  return datos as DatosMascota;
}

/**
 * Editar: solo lo que cambió respecto a los valores iniciales (PATCH). Un campo opcional que
 * se vació va como null. Sin alergias, el detalle se borra.
 */
export function aCambios(form: MascotaForm, inicial: MascotaForm): CambiosMascota {
  const cambios: Record<string, unknown> = {};
  for (const campo of Object.keys(form) as (keyof MascotaForm)[]) {
    const nuevo = valorApi(form, campo);
    if (nuevo !== valorApi(inicial, campo)) cambios[campo] = nuevo;
  }
  if (cambios.nombre === null) delete cambios.nombre;
  return cambios as CambiosMascota;
}
