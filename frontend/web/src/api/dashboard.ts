import { apiGet } from "./client";
import type { components } from "./schema";
import type { DataGet } from "./types";

export type Dashboard = DataGet<"/negocios/{id_negocio}/dashboard">;
export type SeccionBloqueada = components["schemas"]["SeccionBloqueada"];
export type Avanzadas = Dashboard["avanzadas"];

export interface ConsultaDashboard {
  desde: string;
  hasta: string;
  id_sucursal?: number;
}

/**
 * Requiere reportes.ver. Rango máximo de 92 días en Gratuito (más: 422 con
 * `errors.plan_requerido`) y 366 con estadísticas avanzadas.
 */
export const getDashboard = (idNegocio: number, { desde, hasta, id_sucursal }: ConsultaDashboard) =>
  apiGet<Dashboard>(`/negocios/${idNegocio}/dashboard`, { desde, hasta, id_sucursal });

/** Las secciones de `avanzadas` llegan bloqueadas en un plan sin estadísticas avanzadas. */
export const estaBloqueada = (seccion: unknown): seccion is SeccionBloqueada =>
  typeof seccion === "object" && seccion !== null && "bloqueado" in seccion;
