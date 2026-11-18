import { http, HttpResponse } from "msw";

export const API = "http://api.test/api/v1";

/** Respuesta de la API con su envoltorio { success, message, data }. */
export const ok = <T>(data: T, message = "OK") => HttpResponse.json({ success: true, message, data });

/** Error de la API: { success: false, message, errors? }. */
export const fallo = (status: number, message: string, errors?: Record<string, string>) =>
  HttpResponse.json({ success: false, message, ...(errors && { errors }) }, { status });

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

export const sesionDemo = (n = 1, usuario = usuarioDemo) => ({
  access_token: `access-${n}`,
  refresh_token: `refresh-${n}`,
  usuario,
});

export const perfilDemo = (requiere_aceptar_politica = false, usuario = usuarioDemo) => ({
  ...usuario,
  telefono_verificado: false,
  idioma: "es",
  zona_horaria: "America/Bogota",
  notif_email: true,
  notif_push: true,
  notif_whatsapp: false,
  ultimo_acceso: null,
  fecha_registro: "2026-11-18 10:00:00",
  requiere_aceptar_politica,
  politica: { version: "1.0", url: null },
  politica_aceptada: null,
  negocios: [],
});

// Handlers por defecto. Cada prueba agrega los suyos con server.use(...).
export const handlers = [
  http.get(`${API}/health`, () =>
    ok({ status: "ok", db: "ok", uptime: 42, time: "2026-11-18T13:00:00.000Z" }),
  ),
  http.get(`${API}/politica-datos`, () => ok({ version: "1.0", url: null })),
];
