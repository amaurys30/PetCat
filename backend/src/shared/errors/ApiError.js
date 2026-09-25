/**
 * Error de la API con código HTTP. El errorHandler lo traduce a
 * { success: false, message, errors }.
 *
 *   throw ApiError.notFound("Mascota no encontrada");
 *   throw ApiError.unprocessable("Datos inválidos", { email: "Formato inválido" });
 */
export class ApiError extends Error {
  /**
   * @param {number} status  Código HTTP (4xx o 5xx)
   * @param {string} message Mensaje para el usuario
   * @param {Record<string, string>} [errors] Detalle por campo
   */
  constructor(status, message, errors) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    if (errors) this.errors = errors;
  }

  static badRequest(message = "Solicitud inválida", errors) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = "No autenticado") {
    return new ApiError(401, message);
  }

  static forbidden(message = "No tienes permiso para realizar esta acción") {
    return new ApiError(403, message);
  }

  static notFound(message = "Recurso no encontrado") {
    return new ApiError(404, message);
  }

  static conflict(message = "Conflicto con el estado actual del recurso", errors) {
    return new ApiError(409, message, errors);
  }

  static unprocessable(message = "Datos inválidos", errors) {
    return new ApiError(422, message, errors);
  }

  static tooMany(message = "Demasiadas solicitudes, intenta más tarde") {
    return new ApiError(429, message);
  }

  static internal(message = "Error interno del servidor") {
    return new ApiError(500, message);
  }
}

export default ApiError;
