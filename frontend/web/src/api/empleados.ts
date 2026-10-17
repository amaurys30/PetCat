import { apiDelete, apiGet, apiGetPagina, apiPatch, apiPost, apiPostRespuesta, apiPut } from "./client";
import type { CitaAfectada } from "./negocios";
import type { components } from "./schema";
import type { Body, DataGet } from "./types";

type Schemas = components["schemas"];

export type Empleado = Schemas["Empleado"];
export type Profesional = DataGet<"/negocios/{id_negocio}/profesionales">[number];
export type InvitacionEnviada = Schemas["InvitacionEnviada"];
export type CrearEmpleadoBody = Body<"/negocios/{id_negocio}/empleados", "post">;
export type ActualizarEmpleadoBody = Body<"/empleados/{id_empleado}", "patch">;
export type EmpleadoPropioBody = NonNullable<Body<"/negocios/{id_negocio}/empleados/yo", "post">>;

export interface FiltrosEmpleados {
  page?: number;
  limit?: number;
  activo?: boolean;
  q?: string;
}

/** Requiere empleados.ver. Paginado; activos primero. */
export const getEmpleados = (idNegocio: number, params: FiltrosEmpleados) =>
  apiGetPagina<Empleado>(`/negocios/${idNegocio}/empleados`, params);

/** Requiere citas.ver. Miembros activos, sin contacto, con los servicios que atienden (agenda). */
export const getProfesionales = (idNegocio: number) =>
  apiGet<Profesional[]>(`/negocios/${idNegocio}/profesionales`);

/** Detalle con los permisos del rol. Requiere empleados.ver. */
export const getEmpleado = (idEmpleado: number) => apiGet<Empleado>(`/empleados/${idEmpleado}`);

/** Requiere empleados.crear (y servicios.editar si trae `servicios`). 403 con `errors.plan` en el límite. */
export const crearEmpleado = (idNegocio: number, body: CrearEmpleadoBody) =>
  apiPost<Empleado>(`/negocios/${idNegocio}/empleados`, body);

export const actualizarEmpleado = (idEmpleado: number, body: ActualizarEmpleadoBody) =>
  apiPatch<Empleado>(`/empleados/${idEmpleado}`, body);

/** Borrado lógico. Trae todas sus citas futuras pendientes o confirmadas. */
export const desactivarEmpleado = (idEmpleado: number) =>
  apiDelete<{ empleado: Empleado; citas_afectadas: CitaAfectada[] }>(`/empleados/${idEmpleado}`);

export const reactivarEmpleado = (idEmpleado: number) =>
  apiPatch<Empleado>(`/empleados/${idEmpleado}/reactivar`);

/** Solo el propietario: 201 si se creó, 200 si se vinculó el empleado que ya tenía su email. */
export const registrarmeComoEmpleado = (idNegocio: number, body: EmpleadoPropioBody) =>
  apiPostRespuesta<Empleado>(`/negocios/${idNegocio}/empleados/yo`, body);

/** multipart con el archivo en `foto`. */
export const subirFotoEmpleado = (idEmpleado: number, archivo: File, onProgreso?: (p: number) => void) => {
  const datos = new FormData();
  datos.append("foto", archivo);
  return apiPut<Empleado>(`/empleados/${idEmpleado}/foto`, datos, {
    onUploadProgress: (e) => e.total && onProgreso?.(Math.round((e.loaded / e.total) * 100)),
  });
};

export const quitarFotoEmpleado = (idEmpleado: number) =>
  apiDelete<Empleado>(`/empleados/${idEmpleado}/foto`);

/** 409 si ya tiene una vigente (usar reenviar) o si se agotaron los 4 correos en 24 h; 503 si el correo falla. */
export const enviarInvitacion = (idEmpleado: number) =>
  apiPost<InvitacionEnviada>(`/empleados/${idEmpleado}/invitacion`);

/** Invalida la vigente y envía otra. */
export const reenviarInvitacion = (idEmpleado: number) =>
  apiPost<InvitacionEnviada>(`/empleados/${idEmpleado}/invitacion/reenviar`);
