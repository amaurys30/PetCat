import { apiGet, apiGetPagina, apiPatch, apiPost } from "./client";
import type { components } from "./schema";
import type { DataGet } from "./types";

export type Notificacion = components["schemas"]["Notificacion"];
export type TipoNotificacion = Notificacion["tipo"];
export type NoLeidas = DataGet<"/notificaciones/no-leidas">;

/** El panel pide siempre las del negocio: las de la app del dueño no se mezclan. */
const DESTINO = "negocio";

export const getNotificaciones = async ({
  page,
  limit,
  soloNoLeidas,
}: {
  page: number;
  limit: number;
  soloNoLeidas?: boolean;
}) =>
  apiGetPagina<Notificacion>("/notificaciones", {
    destino: DESTINO,
    page,
    limit,
    leidas: soloNoLeidas ? "false" : undefined,
  });

export const getNoLeidas = () => apiGet<NoLeidas>("/notificaciones/no-leidas", { destino: DESTINO });

export const marcarLeida = (idNotificacion: number) =>
  apiPatch<Notificacion>(`/notificaciones/${idNotificacion}/leida`);

export const leerTodas = () =>
  apiPost<{ actualizadas: number }>(`/notificaciones/leer-todas?destino=${DESTINO}`);
