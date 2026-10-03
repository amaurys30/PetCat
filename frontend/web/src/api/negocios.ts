import { apiGet } from "./client";
import type { NegocioMio, Suscripcion } from "./types";

export const getMisNegocios = () => apiGet<NegocioMio[]>("/negocios/mios");

/** Requiere configuracion.ver. */
export const getSuscripcion = (idNegocio: number) =>
  apiGet<Suscripcion>(`/negocios/${idNegocio}/suscripcion`);
