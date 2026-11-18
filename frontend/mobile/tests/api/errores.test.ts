import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";

import { ApiError, normalizarError } from "@/api/errores";

function errorConRespuesta(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() };
  const response = { status, data, statusText: "", headers: {}, config } as AxiosResponse;
  return new AxiosError("falló", "ERR_BAD_RESPONSE", config, null, response);
}

describe("normalizarError", () => {
  it("toma message y errors del cuerpo de la API", () => {
    const error = normalizarError(
      errorConRespuesta(422, { success: false, message: "Datos inválidos", errors: { email: "Requerido" } }),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.message).toBe("Datos inválidos");
    expect(error.errors).toEqual({ email: "Requerido" });
    expect(error.sinConexion).toBe(false);
  });

  it("usa un mensaje genérico si la respuesta no trae message", () => {
    const error = normalizarError(errorConRespuesta(500, "<html>"));
    expect(error.status).toBe(500);
    expect(error.message).toBe("Ocurrió un error inesperado.");
    expect(error.errors).toEqual({});
  });

  it("sin respuesta es un error de conexión (status 0)", () => {
    const error = normalizarError(new AxiosError("Network Error", "ERR_NETWORK"));
    expect(error.status).toBe(0);
    expect(error.sinConexion).toBe(true);
  });

  it("devuelve igual un ApiError ya normalizado", () => {
    const original = new ApiError(409, "Horario ocupado");
    expect(normalizarError(original)).toBe(original);
  });
});
