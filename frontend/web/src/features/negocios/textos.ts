import type { NegocioMio } from "@/api/types";

export const rolEnNegocio = (negocio: Pick<NegocioMio, "relacion" | "rol">) =>
  negocio.relacion === "propietario" ? "Propietario" : (negocio.rol?.nombre ?? "Empleado");

/** "Pro · prueba" mientras dura la prueba gratuita. */
export const textoPlan = (plan: NegocioMio["plan"]) =>
  plan.en_prueba ? `${plan.nombre} · prueba` : plan.nombre;
