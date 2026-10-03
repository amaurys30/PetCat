import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

/** API simulada para las pruebas. Cada prueba agrega sus respuestas con `servidor.use(...)`. */
export const servidor = setupServer();

export const API = "http://localhost/api/v1";

export const ok = <T>(data: T, status = 200) =>
  HttpResponse.json({ success: true, message: "OK", data }, { status });

export const fallo = (status: number, message: string, errors?: Record<string, string>) =>
  HttpResponse.json({ success: false, message, ...(errors && { errors }) }, { status });

export { http, HttpResponse };
