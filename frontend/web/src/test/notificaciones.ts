import type { Notificacion } from "@/api/notificaciones";

export const notificacionDemo = (cambios: Partial<Notificacion> = {}): Notificacion => ({
  id_notificacion: 1,
  id_negocio: 1,
  destino: "negocio",
  tipo: "cita_nueva",
  titulo: "Nueva cita por confirmar",
  mensaje: "Sofía Gómez reservó Consulta general para Luna. Queda pendiente hasta que la confirmes.",
  datos: { tipo: "cita_nueva", id_cita: 77, id_negocio: 1, fecha: "2026-10-28", por_confirmar: true },
  leida: false,
  leida_en: null,
  fecha_creacion: "2026-10-25 09:00:00",
  ...cambios,
});

/** Respuesta paginada de `GET /notificaciones`. */
export const paginaNotificaciones = (data: Notificacion[], hasNext = false) => ({
  success: true,
  message: "OK",
  data,
  meta: {
    total: data.length,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNext,
    no_leidas: data.filter((n) => !n.leida).length,
  },
});
