import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ApiError } from "@/api/errors";

/**
 * Pasa los `errors` de un 422 de la API a los campos del formulario.
 * Las llaves de la API usan punto en los anidados (`horarios.1.hora_cierre`), igual
 * que React Hook Form. Devuelve true si marcó al menos un campo del formulario.
 */
export function aplicarErroresApi<T extends FieldValues>(
  setError: UseFormSetError<T>,
  error: ApiError,
  campos: readonly Path<T>[],
): boolean {
  if (error.status !== 422) return false;
  let marcados = 0;
  for (const [campo, mensaje] of Object.entries(error.errors)) {
    if ((campos as readonly string[]).includes(campo)) {
      setError(campo as Path<T>, { type: "server", message: mensaje });
      marcados += 1;
    }
  }
  return marcados > 0;
}
