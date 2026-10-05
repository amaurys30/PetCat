import { isAxiosError } from "axios";

export const MENSAJE_SIN_CONEXION = "No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.";
export const MENSAJE_INESPERADO = "Ocurrió un error inesperado. Intenta de nuevo.";

/**
 * Error normalizado de la API. Todo error que sale del cliente es un ApiError:
 * las pantallas y los manejadores globales solo miran `status`, `message` y `errors`.
 */
export class ApiError extends Error {
  /** null cuando no hubo respuesta (red caída, servidor apagado o tiempo agotado). */
  readonly status: number | null;
  /** Detalle por campo (422) u otros datos del error (`plan` en un 403 por límite del plan). */
  readonly errors: Record<string, string>;
  /** Datos para resolver el error, si la API los manda (las citas del 409 al desactivar un servicio). */
  readonly data: unknown;

  constructor(status: number | null, message: string, errors: Record<string, string> = {}, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
    this.data = data ?? null;
  }

  get sinConexion() {
    return this.status === null;
  }

  /** 403 por límite del plan: trae `errors.plan` con el detalle. */
  get limitePlan(): string | null {
    return this.status === 403 ? (this.errors.plan ?? null) : null;
  }
}

interface CuerpoError {
  message?: unknown;
  errors?: unknown;
  data?: unknown;
}

const comoErrores = (valor: unknown): Record<string, string> => {
  if (!valor || typeof valor !== "object") return {};
  return Object.fromEntries(
    Object.entries(valor as Record<string, unknown>).map(([k, v]) => [
      k,
      typeof v === "string" ? v : String(v),
    ]),
  );
};

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isAxiosError(error)) {
    if (!error.response) return new ApiError(null, MENSAJE_SIN_CONEXION);
    const { status, data } = error.response;
    const cuerpo = (data ?? {}) as CuerpoError;
    const message =
      typeof cuerpo.message === "string" && cuerpo.message ? cuerpo.message : MENSAJE_INESPERADO;
    return new ApiError(status, message, comoErrores(cuerpo.errors), cuerpo.data);
  }
  return new ApiError(0, error instanceof Error ? error.message : MENSAJE_INESPERADO);
}
