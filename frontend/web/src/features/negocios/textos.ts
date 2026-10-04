import type { NegocioMio } from "@/api/types";

export const rolEnNegocio = (negocio: Pick<NegocioMio, "relacion" | "rol">) =>
  negocio.relacion === "propietario" ? "Propietario" : (negocio.rol?.nombre ?? "Empleado");

/** "Pro · prueba" mientras dura la prueba gratuita. */
export const textoPlan = (plan: NegocioMio["plan"]) =>
  plan.en_prueba ? `${plan.nombre} · prueba` : plan.nombre;

export const TIPOS_NEGOCIO = {
  veterinaria: "Veterinaria",
  tienda_mascotas: "Tienda de mascotas",
  peluqueria_canina: "Peluquería canina",
  guarderia: "Guardería",
  entrenador: "Entrenador",
  clinica: "Clínica",
  multiservicio: "Multiservicio",
} as const;

export type TipoNegocio = keyof typeof TIPOS_NEGOCIO;

/** "1 sede", "30 citas al mes"; -1 es ilimitado ("citas ilimitadas"). */
export const textoLimite = (maximo: number, singular: string, plural: string, ilimitado: string) =>
  maximo === -1 ? ilimitado : `${maximo} ${maximo === 1 ? singular : plural}`;
