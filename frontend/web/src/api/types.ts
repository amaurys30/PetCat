import type { components, paths } from "./schema";

/**
 * Tipos de la API derivados de schema.d.ts (generado con `npm run api:types`).
 * Swagger no marca los campos como `required`, así que el generador los deja todos
 * opcionales. `Completo` los vuelve obligatorios (también en los objetos anidados)
 * para las entidades que la API siempre envía completas (ver "Pendientes de API" en PLAN.md).
 * Los `null` se conservan.
 */
export type Completo<T> = T extends (infer U)[]
  ? Completo<U>[]
  : T extends object
    ? { [K in keyof T]-?: Completo<Exclude<T[K], undefined>> }
    : T;

type Schemas = components["schemas"];

/** Cuerpo JSON de una operación. */
export type Body<P extends keyof paths, M extends "post" | "put" | "patch"> =
  NonNullable<paths[P][M]> extends { requestBody?: { content: { "application/json": infer B } } } ? B : never;

export type Meta = Completo<Schemas["PaginationMeta"]>;

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

export type Usuario = Completo<Schemas["Usuario"]>;

export interface Sesion {
  access_token: string;
  refresh_token: string;
  usuario: Usuario;
}

export type NegocioMio = Completo<Schemas["NegocioMio"]>;
export type RolMio = NonNullable<NegocioMio["rol"]>;

export type Me = Completo<Schemas["PerfilPropio"]> & {
  requiere_aceptar_politica: boolean;
  politica: { version: string; url: string | null };
  negocios: NegocioMio[];
};

export type UsoLimite = Completo<Schemas["UsoLimite"]>;
export type Suscripcion = Completo<Schemas["Suscripcion"]>;
