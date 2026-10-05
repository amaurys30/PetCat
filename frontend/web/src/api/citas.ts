import { apiGet } from "./client";
import type { components } from "./schema";
import type { DataGet } from "./types";

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
