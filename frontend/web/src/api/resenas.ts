import { apiDelete, apiGetPagina, apiPost, apiPut } from "./client";
import type { components, paths } from "./schema";
import type { Body } from "./types";

export type ResenaPanel = components["schemas"]["ResenaPanel"];
export type EstadoResena = ResenaPanel["estado"];
export type MotivoReporte = NonNullable<ResenaPanel["reporte"]>["motivo"];
export type ReporteBody = Body<"/resenas/{id_resena}/reportar", "post">;

type MetaGestion =
  paths["/negocios/{id_negocio}/resenas/gestion"]["get"]["responses"][200]["content"]["application/json"]["meta"];
export type ResumenResenas = MetaGestion["resumen"];

export interface FiltrosResenas {
  orden?: "recientes" | "mejores" | "peores";
  estado?: EstadoResena;
  sin_responder?: boolean;
  reportada?: boolean;
  calificacion_max?: number;
  id_resena?: number;
}

const booleano = (valor?: boolean) => (valor === undefined ? undefined : String(valor));

/** Requiere resenas.ver. Publicadas, ocultas por la moderación y retiradas, con `meta.resumen`. */
export const getResenasGestion = async (
  idNegocio: number,
  { sin_responder, reportada, ...filtros }: FiltrosResenas & { page: number; limit: number },
) => {
  const pagina = await apiGetPagina<ResenaPanel>(`/negocios/${idNegocio}/resenas/gestion`, {
    ...filtros,
    sin_responder: booleano(sin_responder),
    reportada: booleano(reportada),
  });
  return { data: pagina.data, meta: pagina.meta as MetaGestion };
};

/** resenas.responder. Crea o reemplaza la respuesta pública del negocio. */
export const responderResena = (idResena: number, respuesta: string) =>
  apiPut<ResenaPanel>(`/resenas/${idResena}/respuesta`, { respuesta });

export const borrarRespuesta = (idResena: number) => apiDelete<ResenaPanel>(`/resenas/${idResena}/respuesta`);

/** resenas.reportar. Una vez por reseña (409 si ya se reportó); sigue publicada hasta que PetCat la revise. */
export const reportarResena = (idResena: number, body: ReporteBody) =>
  apiPost<ResenaPanel>(`/resenas/${idResena}/reportar`, body);
