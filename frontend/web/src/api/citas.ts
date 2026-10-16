import { apiGet, apiPatch, apiPost } from "./client";
import type { components } from "./schema";
import type { Body, DataGet } from "./types";

type Schemas = components["schemas"];

export type Cita = Schemas["Cita"];
export type CitaPanel = Schemas["CitaPanel"];
export type EstadoCita = Cita["estado"];
export type MotivoFuera = NonNullable<CitaPanel["motivo_fuera"]>;
export type Atencion = DataGet<"/negocios/{id_negocio}/citas/atencion">;

/** Filtros comunes de la agenda y de la atención (los de la URL de la agenda). */
export interface FiltrosAgenda {
  id_sucursal?: number;
  id_empleado?: number;
  solo_mias?: boolean;
}

const params = ({ id_sucursal, id_empleado, solo_mias }: FiltrosAgenda) => ({
  id_sucursal,
  id_empleado,
  solo_mias: solo_mias ? "true" : undefined,
});

/** Requiere citas.ver. Rango máximo de 31 días (por fecha y hora, sin paginar). */
export const getAgenda = (
  idNegocio: number,
  {
    desde,
    hasta,
    estados,
    ...filtros
  }: FiltrosAgenda & { desde: string; hasta: string; estados?: EstadoCita[] },
) =>
  apiGet<CitaPanel[]>(`/negocios/${idNegocio}/citas`, {
    desde,
    hasta,
    estado: estados?.length ? estados.join(",") : undefined,
    ...params(filtros),
  });

/** Requiere citas.ver. Por confirmar y fuera de disponibilidad, desde hoy y sin límite de rango. */
export const getAtencion = (idNegocio: number, filtros: FiltrosAgenda) =>
  apiGet<Atencion>(`/negocios/${idNegocio}/citas/atencion`, params(filtros));

export type CitaPanelDetalle = Schemas["CitaPanelDetalle"];
export type CambioHistorial = DataGet<"/citas/{id_cita}/historial">[number];
export type ProfesionalesLibres = DataGet<"/citas/{id_cita}/profesionales-libres">;
export type HorariosLibres = Schemas["HorariosLibres"];
export type CambiarEstadoBody = Body<"/citas/{id_cita}/estado", "patch">;
export type ReprogramarBody = Body<"/citas/{id_cita}/reprogramar", "post">;
export type ActualizarCitaBody = Body<"/citas/{id_cita}", "patch">;

/** Detalle del panel (con citas.ver): datos de la mascota, contacto y cumplimiento del cliente. */
export const getCita = (idCita: number) => apiGet<CitaPanelDetalle>(`/citas/${idCita}`);

export const getHistorialCita = (idCita: number) => apiGet<CambioHistorial[]>(`/citas/${idCita}/historial`);

/** citas.editar. Transiciones de la API: confirmar, iniciar, no asistió y completar (con precio final). */
export const cambiarEstadoCita = (idCita: number, body: CambiarEstadoBody) =>
  apiPatch<CitaPanelDetalle>(`/citas/${idCita}/estado`, body);

/** citas.cancelar. El negocio debe dar el motivo (lo ve el cliente). */
export const cancelarCita = (idCita: number, motivo: string) =>
  apiPost<CitaPanelDetalle>(`/citas/${idCita}/cancelar`, { motivo });

/** citas.editar. Responde la cita nueva (confirmada); la original queda reprogramada. */
export const reprogramarCita = (idCita: number, body: ReprogramarBody) =>
  apiPost<Cita>(`/citas/${idCita}/reprogramar`, body);

/** citas.editar. Notas internas, prioridad, precio final o reasignar (`id_empleado`). */
export const actualizarCita = (idCita: number, body: ActualizarCitaBody) =>
  apiPatch<CitaPanelDetalle>(`/citas/${idCita}`, body);

/** citas.editar. Quién puede tomar la cita a su hora (para reasignar). */
export const getProfesionalesLibres = (idCita: number) =>
  apiGet<ProfesionalesLibres>(`/citas/${idCita}/profesionales-libres`);

export interface ConsultaHorarios {
  id_servicio: number;
  id_sucursal: number;
  fecha: string;
  id_empleado?: number;
  /** La cita que se reprograma: no ocupa su hora (exige citas.editar). */
  id_cita_excluir?: number;
}

/** citas.crear o citas.editar. Sin antelación mínima; `motivo_sin_horarios` si no hay. */
export const getHorariosLibresPanel = (idNegocio: number, consulta: ConsultaHorarios) =>
  apiGet<HorariosLibres>(`/negocios/${idNegocio}/citas/horarios-libres`, consulta);
