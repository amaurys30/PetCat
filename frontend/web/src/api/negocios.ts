import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "./client";
import type { Body, NegocioMio, Suscripcion } from "./types";
import type { components } from "./schema";

type Schemas = components["schemas"];

export type Negocio = Schemas["Negocio"];
export type NegocioGestion = Schemas["NegocioGestion"];
export type NegocioPublico = Schemas["NegocioPublico"];
export type SucursalGestion = NegocioGestion["sucursales"][number];
export type Sucursal = Schemas["Sucursal"];
export type Horario = Schemas["Horario"];
export type CitaAfectada = Schemas["CitaAfectada"];
export type Plan = Schemas["Plan"];
export type TipoNegocio = Negocio["tipo"];

export type CrearNegocioBody = Body<"/negocios", "post">;
export type ActualizarNegocioBody = Body<"/negocios/{id_negocio}", "patch">;
export type CrearSucursalBody = Body<"/negocios/{id_negocio}/sucursales", "post">;
export type ActualizarSucursalBody = Body<"/sucursales/{id_sucursal}", "patch">;
export type HorariosBody = Body<"/sucursales/{id_sucursal}/horarios", "put">;

export const getMisNegocios = () => apiGet<NegocioMio[]>("/negocios/mios");

/** Pública: sedes activas con su horario (la principal primero). 404 si el negocio está inactivo. */
export const getPerfilPublico = (idNegocio: number) => apiGet<NegocioPublico>(`/negocios/${idNegocio}`);

/** Requiere configuracion.ver. */
export const getSuscripcion = (idNegocio: number) =>
  apiGet<Suscripcion>(`/negocios/${idNegocio}/suscripcion`);

/** Pública. */
export const getPlanes = () => apiGet<Plan[]>("/planes");

/** Solo el propietario (y el admin). 409 si ya la usó o ya tiene un plan pago. */
export const iniciarPruebaPro = (idNegocio: number) =>
  apiPost<Suscripcion>(`/negocios/${idNegocio}/suscripcion/prueba-pro`);

export const crearNegocio = (body: CrearNegocioBody) => apiPost<Negocio>("/negocios", body);

/** Vista del panel (configuracion.ver): datos privados, sedes con horarios y reglas de confirmación. */
export const getGestion = (idNegocio: number) => apiGet<NegocioGestion>(`/negocios/${idNegocio}/gestion`);

export const actualizarNegocio = (idNegocio: number, body: ActualizarNegocioBody) =>
  apiPatch<Negocio>(`/negocios/${idNegocio}`, body);

export const crearSucursal = (idNegocio: number, body: CrearSucursalBody) =>
  apiPost<Sucursal>(`/negocios/${idNegocio}/sucursales`, body);

export const actualizarSucursal = (idSucursal: number, body: ActualizarSucursalBody) =>
  apiPatch<Sucursal>(`/sucursales/${idSucursal}`, body);

/** Borrado lógico. 409 con citas futuras, o si es la principal y hay otras. */
export const eliminarSucursal = (idSucursal: number) => apiDelete<unknown>(`/sucursales/${idSucursal}`);

/** Reemplaza la semana completa. `citas_afectadas` solo viene en esta respuesta. */
export const guardarHorarios = (idSucursal: number, body: HorariosBody) =>
  apiPut<{ horarios: Horario[]; citas_afectadas: CitaAfectada[] }>(
    `/sucursales/${idSucursal}/horarios`,
    body,
  );

export type TipoImagen = "logo" | "banner";

/** multipart: el archivo va en el campo `logo` o `banner`. */
export const subirImagenNegocio = (
  idNegocio: number,
  tipo: TipoImagen,
  archivo: File,
  onProgreso?: (porcentaje: number) => void,
) => {
  const datos = new FormData();
  datos.append(tipo, archivo);
  return apiPut<Negocio>(`/negocios/${idNegocio}/${tipo}`, datos, {
    onUploadProgress: (e) => e.total && onProgreso?.(Math.round((e.loaded / e.total) * 100)),
  });
};

export const eliminarImagenNegocio = (idNegocio: number, tipo: TipoImagen) =>
  apiDelete<Negocio>(`/negocios/${idNegocio}/${tipo}`);
