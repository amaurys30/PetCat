import type { components, paths } from "./schema";

/**
 * Tipos de la API derivados de schema.d.ts (generado con `npm run api:types`).
 * En las respuestas, Swagger marca como requerido todo campo que la API envía siempre;
 * los que pueden faltar quedan opcionales (`x-opcional` en el backend).
 */
type Schemas = components["schemas"];

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

export interface Pagina<T> {
  data: T[];
  meta: Meta;
}

export type Permisos = Schemas["Permisos"];
export type Modulo = keyof Permisos & string;

export type Usuario = Schemas["Usuario"];
export type Sesion = Schemas["Sesion"];
export type NegocioMio = Schemas["NegocioMio"];
export type RolMio = NonNullable<NegocioMio["rol"]>;
export type Me = DataGet<"/auth/me">;
export type UsoLimite = Schemas["UsoLimite"];
export type Suscripcion = Schemas["Suscripcion"];
