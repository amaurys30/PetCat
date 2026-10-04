import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import type { components } from "./schema";
import type { Body, DataGet, Permisos } from "./types";

export type Rol = components["schemas"]["Rol"];
/** Rol del listado del negocio, con cuántos empleados activos e inactivos lo tienen. */
export type RolNegocio = DataGet<"/negocios/{id_negocio}/roles">[number];
export type CrearRolBody = Body<"/negocios/{id_negocio}/roles", "post">;
export type ActualizarRolBody = Body<"/roles/{id_rol}", "patch">;

/** Requiere roles.ver, empleados.crear o empleados.editar. Los del sistema primero. */
export const getRoles = (idNegocio: number) => apiGet<RolNegocio[]>(`/negocios/${idNegocio}/roles`);

/** Catálogo de módulos y acciones que puede llevar un rol. */
export const getCatalogoPermisos = () => apiGet<Permisos>("/permisos");

export const crearRol = (idNegocio: number, body: CrearRolBody) =>
  apiPost<Rol>(`/negocios/${idNegocio}/roles`, body);

export const actualizarRol = (idRol: number, body: ActualizarRolBody) => apiPatch<Rol>(`/roles/${idRol}`, body);

/** 409 si algún empleado (activo o inactivo) tiene el rol. */
export const eliminarRol = (idRol: number) => apiDelete<null>(`/roles/${idRol}`);
