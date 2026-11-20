import type { components, paths } from "./api-types";

/**
 * Tipos de la API derivados de api-types.ts (generado con `npm run api:types`, no editar).
 * En las respuestas, Swagger marca como requerido todo campo que la API envía siempre;
 * los que pueden faltar quedan opcionales (`x-opcional` en el backend).
 */
export type Schemas = components["schemas"];

/** Cuerpo JSON de una operación. */
export type Body<P extends keyof paths, M extends "post" | "put" | "patch"> =
  NonNullable<paths[P][M]> extends { requestBody?: { content: { "application/json": infer B } } } ? B : never;

/** `data` de la respuesta 200 de un GET. */
export type DataGet<P extends keyof paths> =
  NonNullable<paths[P]["get"]> extends {
    responses: { 200: { content: { "application/json": { data: infer D } } } };
  }
    ? D
    : never;

export type Meta = Schemas["PaginationMeta"];

/** Envoltorio de todas las respuestas: { success, message, data, meta? } */
export interface Respuesta<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: Meta;
}

export type Usuario = Schemas["Usuario"];
/** Respuesta de login y de `POST /auth/refresh-token`. */
export type SesionApi = Schemas["Sesion"];
export type Salud = DataGet<"/health">;

export type Mascota = Schemas["Mascota"];
export type ResumenMascota = Schemas["ResumenMascota"];
/** Mascota de `GET /mascotas?incluir=resumen` (el resumen siempre llega con incluir). */
export type MascotaConResumen = Mascota & { resumen: ResumenMascota };
export type EventoSalud = ResumenMascota["proximos_eventos"][number];
export type CitaResumen = NonNullable<ResumenMascota["proxima_cita"]>;
export type Pesos = DataGet<"/mascotas/{id_mascota}/pesos">;
export type PuntoPeso = Pesos["puntos"][number];
export type DatosMascota = Body<"/mascotas", "post">;
export type CambiosMascota = Body<"/mascotas/{id_mascota}", "patch">;
export type Especie = NonNullable<DatosMascota["especie"]>;
export type Sexo = NonNullable<DatosMascota["sexo"]>;

export type Vacuna = Schemas["Vacuna"];
export type EstadoVacuna = Vacuna["estado"];
export type RegistroHistorial = Schemas["RegistroHistorial"];

export type NegocioBusqueda = Schemas["NegocioBusqueda"];
export type SucursalCercana = NonNullable<NegocioBusqueda["sucursal_cercana"]>;
export type NegocioPublico = Schemas["NegocioPublico"];
export type SucursalPublica = NegocioPublico["sucursales"][number];
export type HorarioRango = Schemas["HorarioRango"];
export type ServicioNegocio = NegocioPublico["servicios"][number];
export type ResenaPublica = Schemas["ResenaPublica"];

export type Cita = Schemas["Cita"];
export type EstadoCita = Cita["estado"];
export type HorariosLibres = Schemas["HorariosLibres"];
export type HorarioLibre = HorariosLibres["horarios"][number];
export type DatosReserva = Body<"/citas", "post">;
export type DatosReprogramacion = Body<"/citas/{id_cita}/reprogramar", "post">;
