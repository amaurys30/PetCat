import { apiGet, apiGetPagina, apiPut } from "./client";
import type { components } from "./schema";
import type { Body, Suscripcion } from "./types";

export type NegocioAdmin = components["schemas"]["NegocioAdmin"];
export type SuscripcionHistorial = components["schemas"]["SuscripcionHistorial"];
export type EstadoPlanAdmin = NegocioAdmin["estado"];
export type AsignarPlanBody = Body<"/negocios/{id_negocio}/suscripcion", "put">;

export interface FiltrosAdmin {
  q?: string;
  id_plan?: number;
  estado?: EstadoPlanAdmin;
}

/** Solo el super admin. Plan y estado efectivos, suscripción vigente y citas del mes. */
export const getNegociosAdmin = (params: FiltrosAdmin & { page: number; limit: number }) =>
  apiGetPagina<NegocioAdmin>("/admin/negocios", params);

/** Solo el super admin. De la más reciente a la más antigua, con quién creó cada una. */
export const getHistorialSuscripciones = (idNegocio: number) =>
  apiGet<SuscripcionHistorial[]>(`/admin/negocios/${idNegocio}/suscripciones`);

/** Solo el super admin: cierra la vigente y crea una activa desde hoy. */
export const asignarPlan = (idNegocio: number, body: AsignarPlanBody) =>
  apiPut<Suscripcion>(`/negocios/${idNegocio}/suscripcion`, body);
