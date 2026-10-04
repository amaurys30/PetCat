import { apiGetPagina } from "./client";
import type { components } from "./schema";

export type Empleado = components["schemas"]["Empleado"];

/** Requiere empleados.ver. Paginado. */
export const getEmpleados = (
  idNegocio: number,
  params: { page?: number; limit?: number; activo?: boolean },
) => apiGetPagina<Empleado>(`/negocios/${idNegocio}/empleados`, params);
