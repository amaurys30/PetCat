import type { ApiError } from "@/api/errors";
import { useUi } from "@/stores/ui";

/**
 * Errores de las acciones sobre una cita, en los diálogos. El 403 por límite del plan abre
 * el diálogo de Pro (en el onError de la mutación) y no se repite en el formulario; lo demás
 * (409 con el motivo, 403 sin permiso, red caída) se muestra tal cual dentro del diálogo.
 */
export const mensajeDeError = (error: ApiError | null): string | null =>
  !error || error.limitePlan ? null : error.message;

export function abrirLimitePlanSiAplica(error: ApiError) {
  if (error.limitePlan) useUi.getState().abrirLimitePlan(error.message);
}
