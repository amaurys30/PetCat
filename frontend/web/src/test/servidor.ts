import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export const API = "http://localhost/api/v1";

export const ok = <T>(data: T, status = 200) =>
  HttpResponse.json({ success: true, message: "OK", data }, { status });

export const fallo = (status: number, message: string, errors?: Record<string, string>) =>
  HttpResponse.json({ success: false, message, ...(errors && { errors }) }, { status });

/**
 * API simulada para las pruebas. Cada prueba agrega sus respuestas con `servidor.use(...)`.
 * Por defecto, la atención de la agenda (la pide el menú lateral en todas las pantallas) va vacía.
 */
export const servidor = setupServer(
  http.get(`${API}/negocios/:idNegocio/citas/atencion`, () =>
    ok({ por_confirmar: [], fuera_de_disponibilidad: [] }),
  ),
);

export { http, HttpResponse };
