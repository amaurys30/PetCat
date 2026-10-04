import { useOutletContext } from "react-router";
import type { NegocioGestion } from "@/api/negocios";

/** Lo que ConfiguracionLayout pasa a sus pestañas. */
export interface ContextoConfiguracion {
  negocio: NegocioGestion;
  /** Con solo configuracion.ver, las pestañas se muestran en modo lectura. */
  puedeEditar: boolean;
  destinoAcciones: HTMLElement | null;
}

export const useConfiguracion = () => useOutletContext<ContextoConfiguracion>();
