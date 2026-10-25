import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export const API = "http://localhost/api/v1";

export const ok = <T>(data: T, status = 200) =>
  HttpResponse.json({ success: true, message: "OK", data }, { status });

export const fallo = (status: number, message: string, errors?: Record<string, string>) =>
  HttpResponse.json({ success: false, message, ...(errors && { errors }) }, { status });

/**
 * API simulada para las pruebas. Cada prueba agrega sus respuestas con `servidor.use(...)`.
 * Por defecto, la atención de la agenda (la pide el menú lateral en todas las pantallas) va vacía,
 * y la campana del Topbar no tiene notificaciones.
 */
export const servidor = setupServer(
  http.get(`${API}/negocios/:idNegocio/citas/atencion`, () =>
    ok({ por_confirmar: [], fuera_de_disponibilidad: [] }),
  ),
  // El número de reseñas sin responder del menú.
  http.get(`${API}/negocios/:idNegocio/resenas/gestion`, () =>
    HttpResponse.json({
      success: true,
      message: "OK",
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 1,
        totalPages: 0,
        hasNext: false,
        resumen: {
          calificacion_promedio: 0,
          total_resenas: 0,
          distribucion: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          sin_responder: 0,
          reportadas: 0,
          ocultas: 0,
          retiradas: 0,
        },
      },
    }),
  ),
  http.get(`${API}/notificaciones/no-leidas`, () => ok({ total: 0, por_destino: { dueno: 0, negocio: 0 } })),
  http.get(`${API}/notificaciones`, () =>
    HttpResponse.json({
      success: true,
      message: "OK",
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, no_leidas: 0 },
    }),
  ),
);

export { http, HttpResponse };
