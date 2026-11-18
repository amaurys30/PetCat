import { AccessibilityInfo } from "react-native";
import type { FieldErrors, FieldValues, Path, UseFormSetError } from "react-hook-form";

import { ApiError } from "@/api/errors";

/**
 * Anuncia los errores de un envío fallido al lector de pantalla. En Android la región viva del
 * campo ya lo dice; iOS no tiene regiones vivas, así que hace falta el anuncio. React Hook Form
 * pone el foco en el primer campo con error (shouldFocusError).
 */
export function anunciarErrores(errores: FieldErrors) {
  const mensajes = Object.values(errores)
    .map((e) => (typeof e?.message === "string" ? e.message : null))
    .filter((m): m is string => !!m);
  if (mensajes.length === 0) return;
  AccessibilityInfo.announceForAccessibility(
    mensajes.length === 1
      ? `Revisa el formulario: ${mensajes[0]}`
      : `Revisa ${mensajes.length} campos del formulario`,
  );
}

/**
 * Pasa los errores por campo de un 422 de la API al formulario. Devuelve true si marcó alguno
 * (entonces no hace falta mostrar el mensaje general).
 */
export function marcarErroresApi<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  campos: readonly Path<T>[],
): boolean {
  if (!(error instanceof ApiError) || error.status !== 422) return false;
  let marcados = 0;
  for (const campo of campos) {
    const detalle = error.errors[campo];
    if (typeof detalle === "string") {
      setError(campo, { type: "api", message: detalle }, { shouldFocus: marcados === 0 });
      marcados++;
    }
  }
  return marcados > 0;
}
