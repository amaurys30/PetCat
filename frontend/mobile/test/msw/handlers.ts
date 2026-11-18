import { http, HttpResponse } from "msw";

export const API = "http://api.test/api/v1";

/** Respuesta de la API con su envoltorio { success, message, data }. */
export const ok = <T>(data: T, message = "OK") => HttpResponse.json({ success: true, message, data });

export const usuarioDemo = {
  id_usuario: 7,
  nombre: "Sofía",
  apellido: "Gómez",
  email: "sofia@petcat.test",
  telefono: null,
  foto_url: null,
  foto_miniatura_url: null,
  tipo_usuario: "cliente" as const,
  email_verificado: true,
};

// Handlers por defecto. Cada prueba agrega los suyos con server.use(...).
export const handlers = [
  http.get(`${API}/health`, () =>
    ok({ status: "ok", db: "ok", uptime: 42, time: "2026-11-18T13:00:00.000Z" }),
  ),
];
