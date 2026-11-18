import { isAxiosError } from "axios";

// Error normalizado de la API: { success: false, message, errors } o un fallo de red.
export class ApiError extends Error {
  readonly status: number; // 0 = sin respuesta (red caída, servidor apagado, tiempo agotado)
  readonly errors: Record<string, unknown>;

  constructor(status: number, message: string, errors: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }

  get sinConexion() {
    return this.status === 0;
  }
}

type CuerpoError = { message?: unknown; errors?: unknown };

export function normalizarError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isAxiosError(error)) {
    if (!error.response) {
      return new ApiError(0, "No pudimos conectar con PetCat. Revisa tu conexión e inténtalo de nuevo.");
    }
    const { status, data } = error.response;
    const cuerpo = (data ?? {}) as CuerpoError;
    const message =
      typeof cuerpo.message === "string" && cuerpo.message ? cuerpo.message : "Ocurrió un error inesperado.";
    const errors =
      cuerpo.errors && typeof cuerpo.errors === "object" ? (cuerpo.errors as Record<string, unknown>) : {};
    return new ApiError(status, message, errors);
  }
  return new ApiError(0, "Ocurrió un error inesperado.");
}
