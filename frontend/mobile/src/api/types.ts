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
