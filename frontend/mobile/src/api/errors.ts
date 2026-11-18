import { isAxiosError } from "axios";

export type TipoError = "red" | "tiempo" | "sesion" | "http";

/**
 * Error normalizado de la API. `message` siempre es un texto en español listo para mostrar;
 * nunca lleva trazas ni códigos internos. `status` 0 = no hubo respuesta del servidor.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly tipo: TipoError;
  /** Errores por campo (422) u otros detalles que envía la API (`errors.plan`, por ejemplo). */
  readonly errors: Record<string, unknown>;

  constructor(
    status: number,
    message: string,
    tipo: TipoError = "http",
    errors: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.tipo = tipo;
    this.errors = errors;
  }

  get sinConexion() {
    return this.tipo === "red" || this.tipo === "tiempo";
  }
}

export const MENSAJES = {
  red: "Sin conexión. Revisa tu internet e inténtalo de nuevo.",
  tiempo: "La conexión está tardando demasiado. Inténtalo de nuevo.",
  sesion: "Tu sesión expiró. Inicia sesión de nuevo.",
  validacion: "Revisa los datos del formulario.",
  limite: "Hiciste muchos intentos seguidos. Espera un momento e inténtalo de nuevo.",
  servidor: "Tuvimos un problema en el servidor. Inténtalo más tarde.",
  generico: "No pudimos completar la acción. Inténtalo de nuevo.",
} as const;

type CuerpoError = { message?: unknown; errors?: unknown };

const CODIGOS_TIEMPO = new Set(["ECONNABORTED", "ETIMEDOUT"]);

export function sesionExpirada() {
  return new ApiError(401, MENSAJES.sesion, "sesion");
}

/** Convierte cualquier error (axios, red, otro) en un ApiError con mensaje en español. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (!isAxiosError(error)) return new ApiError(0, MENSAJES.generico, "red");

  if (!error.response) {
    return CODIGOS_TIEMPO.has(error.code ?? "")
      ? new ApiError(0, MENSAJES.tiempo, "tiempo")
      : new ApiError(0, MENSAJES.red, "red");
  }

  const { status, data } = error.response;
  const cuerpo = (data && typeof data === "object" ? data : {}) as CuerpoError;
  const mensajeApi = typeof cuerpo.message === "string" && cuerpo.message.trim() ? cuerpo.message : null;
  const errors =
    cuerpo.errors && typeof cuerpo.errors === "object" ? (cuerpo.errors as Record<string, unknown>) : {};

  if (status >= 500) return new ApiError(status, MENSAJES.servidor);
  if (status === 429) return new ApiError(status, MENSAJES.limite, "http", errors);
  if (status === 422) return new ApiError(status, mensajeApi ?? MENSAJES.validacion, "http", errors);
  return new ApiError(status, mensajeApi ?? MENSAJES.generico, "http", errors);
}
