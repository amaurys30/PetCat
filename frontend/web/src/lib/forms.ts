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

/**
 * Para un PATCH: solo los campos que cambiaron respecto a `iniciales`. Un texto vacío va
 * como null (la API vacía el campo). Los textos se comparan sin espacios a los lados.
 */
export function soloCambios<T extends Record<string, unknown>>(
  valores: T,
  iniciales: Partial<Record<keyof T, unknown>>,
): Partial<{ [K in keyof T]: T[K] | null }> {
  const normalizar = (v: unknown) =>
    typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : (v ?? null);
  const cambios: Partial<{ [K in keyof T]: T[K] | null }> = {};
  for (const clave of Object.keys(valores) as (keyof T)[]) {
    const nuevo = normalizar(valores[clave]);
    if (!Object.is(nuevo, normalizar(iniciales[clave]))) cambios[clave] = nuevo as T[keyof T] | null;
  }
  return cambios;
}

/** Para un POST: quita los textos vacíos (la API usa sus valores por defecto). */
export function sinVacios<T extends Record<string, unknown>>(valores: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(valores).filter(
      ([, v]) => v !== null && v !== undefined && !(typeof v === "string" && v.trim() === ""),
    ),
  ) as Partial<T>;
}
