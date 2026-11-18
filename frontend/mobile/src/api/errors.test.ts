import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";

import { ApiError, MENSAJES, toApiError } from "./errors";

function conRespuesta(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() };
  const response = { status, data, statusText: "", headers: {}, config } as AxiosResponse;
  return new AxiosError("falló", "ERR_BAD_RESPONSE", config, null, response);
}

describe("toApiError", () => {
  it("sin respuesta: sin conexión", () => {
    const error = toApiError(new AxiosError("Network Error", "ERR_NETWORK"));
    expect(error).toMatchObject({ status: 0, tipo: "red", message: MENSAJES.red });
    expect(error.sinConexion).toBe(true);
  });

  it("tiempo agotado", () => {
    const error = toApiError(new AxiosError("timeout of 15000ms exceeded", "ECONNABORTED"));
    expect(error).toMatchObject({ status: 0, tipo: "tiempo", message: MENSAJES.tiempo });
  });

  it("422: mensaje de la API y errores por campo", () => {
    const error = toApiError(
      conRespuesta(422, { success: false, message: "Datos inválidos", errors: { email: "Correo inválido" } }),
    );
    expect(error).toMatchObject({
      status: 422,
      message: "Datos inválidos",
      errors: { email: "Correo inválido" },
    });
  });

  it("422 sin mensaje: texto genérico de validación", () => {
    expect(toApiError(conRespuesta(422, {})).message).toBe(MENSAJES.validacion);
  });

  it("409: el mensaje de la API tal cual", () => {
    expect(toApiError(conRespuesta(409, { message: "Ese horario ya está ocupado" })).message).toBe(
      "Ese horario ya está ocupado",
    );
  });

  it("429: el mensaje de la API (dice cuánto esperar); sin mensaje, el genérico", () => {
    const conMensaje = conRespuesta(429, {
      message: "Demasiados intentos, espera 15 minutos antes de volver a intentarlo",
    });
    expect(toApiError(conMensaje).message).toBe(
      "Demasiados intentos, espera 15 minutos antes de volver a intentarlo",
    );
    expect(toApiError(conRespuesta(429, {})).message).toBe(MENSAJES.limite);
  });

  it("5xx: genérico, nunca el detalle interno del servidor", () => {
    const error = toApiError(conRespuesta(500, { message: "ER_NO_SUCH_TABLE: Table 'x' doesn't exist" }));
    expect(error).toMatchObject({ status: 500, message: MENSAJES.servidor });
  });

  it("conserva errors.plan del 403 por límite del plan", () => {
    const error = toApiError(conRespuesta(403, { message: "Límite del plan", errors: { plan: "gratuito" } }));
    expect(error.errors).toEqual({ plan: "gratuito" });
  });

  it("cuerpo no JSON y errores desconocidos", () => {
    expect(toApiError(conRespuesta(404, "<html>")).message).toBe(MENSAJES.generico);
    expect(toApiError(new Error("boom")).message).toBe(MENSAJES.generico);
  });

  it("un ApiError pasa igual", () => {
    const original = new ApiError(404, "Mascota no encontrada");
    expect(toApiError(original)).toBe(original);
  });
});
