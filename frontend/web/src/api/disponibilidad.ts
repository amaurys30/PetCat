import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "./client";
import type { CitaAfectada } from "./negocios";
import type { components } from "./schema";
import type { Body, DataGet } from "./types";

type Schemas = components["schemas"];

export type HorarioSemanal = Schemas["HorarioSemanal"];
export type RangoSemanal = Schemas["RangoSemanal"];
export type Excepcion = Schemas["Excepcion"];
export type TipoExcepcion = Excepcion["tipo"];
export type ExcepcionInput = Schemas["ExcepcionInput"];
export type ActualizarExcepcionBody = Body<"/disponibilidad/{id_disponibilidad}", "patch">;
export type Disponibilidad = DataGet<"/empleados/{id_empleado}/disponibilidad">;
export type DisponibilidadEfectiva = DataGet<"/empleados/{id_empleado}/disponibilidad-efectiva">;

/** configuracion.ver, citas.ver o el propio empleado. Excepciones que terminan hoy o después. */
export const getDisponibilidad = (idEmpleado: number) =>
  apiGet<Disponibilidad>(`/empleados/${idEmpleado}/disponibilidad`);

export const getDisponibilidadEfectiva = (idEmpleado: number, fecha: string) =>
  apiGet<DisponibilidadEfectiva>(`/empleados/${idEmpleado}/disponibilidad-efectiva`, { fecha });

/** configuracion.editar. Lista vacía: sigue el horario de la sede. */
export const guardarHorarioSemanal = (idEmpleado: number, horarios: RangoSemanal[]) =>
  apiPut<{ horario_semanal: HorarioSemanal[]; citas_afectadas: CitaAfectada[] }>(
    `/empleados/${idEmpleado}/horario-semanal`,
    { horarios },
  );

export const crearExcepcion = (idEmpleado: number, body: ExcepcionInput) =>
  apiPost<{ disponibilidad: Excepcion; citas_afectadas: CitaAfectada[] }>(
    `/empleados/${idEmpleado}/disponibilidad`,
    body,
  );

export const actualizarExcepcion = (idDisponibilidad: number, body: ActualizarExcepcionBody) =>
  apiPatch<{ disponibilidad: Excepcion; citas_afectadas: CitaAfectada[] }>(
    `/disponibilidad/${idDisponibilidad}`,
    body,
  );

export const eliminarExcepcion = (idDisponibilidad: number) =>
  apiDelete<{ citas_afectadas: CitaAfectada[] }>(`/disponibilidad/${idDisponibilidad}`);
