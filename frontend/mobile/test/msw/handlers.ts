import { http, HttpResponse } from "msw";

import type { RegistroHistorial, Vacuna } from "@/api/types";

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

const resumenVacio = {
  estado_vacunas: "sin_vacunas" as const,
  vacunas: { vigentes: 0, al_dia: 0, proximas: 0, vencidas: 0 },
  proximos_eventos: [],
  proxima_cita: null,
};

/** Mascota de la API (GET /mascotas?incluir=resumen). */
export function mascotaDemo(cambios: Record<string, unknown> = {}) {
  return {
    id_mascota: 1,
    id_usuario: usuarioDemo.id_usuario,
    nombre: "Luna",
    especie: "perro",
    raza: "Labrador",
    color: null,
    fecha_nacimiento: "2023-05-10",
    edad_meses: 42,
    sexo: "hembra" as const,
    peso: 28.4,
    microchip: null,
    numero_registro: null,
    codigo_pasaporte: "PC-7KQ4-M9XR",
    esterilizado: true,
    tiene_alergias: false,
    compartir_historial: true,
    alergias_detalle: null,
    condiciones_medicas: null,
    tipo_sangre: null,
    foto_url: null,
    foto_miniatura_url: null,
    fallecido: false,
    fecha_fallecimiento: null,
    fecha_registro: "2026-01-10 10:00:00",
    fecha_actualizacion: "2026-11-01 10:00:00",
    resumen: resumenVacio,
    ...cambios,
  };
}

/** Vacuna de la API (GET /mascotas/:id/vacunas). */
export function vacunaDemo(cambios: Partial<Vacuna> = {}): Vacuna {
  return {
    id_vacuna: 1,
    id_mascota: 1,
    nombre_vacuna: "Rabia",
    enfermedad_objetivo: null,
    laboratorio: null,
    lote: null,
    dosis: null,
    via_administracion: null,
    sitio_aplicacion: null,
    fecha_aplicacion: "2025-12-12",
    fecha_proxima: "2026-12-12",
    estado: "al_dia",
    registrada_por: "negocio",
    tiene_comprobante: false,
    comprobante: null,
    notas: null,
    negocio: { id_negocio: 1, nombre: "Clínica Patitas" },
    empleado: null,
    id_historial_medico: null,
    fecha_creacion: "2025-12-12 10:00:00",
    edicion: null,
    ediciones: 0,
    ...cambios,
  } as Vacuna;
}

/** Registro del historial de la API (GET /mascotas/:id/historial). */
export function registroDemo(cambios: Partial<RegistroHistorial> = {}): RegistroHistorial {
  return {
    id_historial: 1,
    id_mascota: 1,
    id_cita: null,
    fecha: "2026-10-14",
    tipo: "consulta_general",
    motivo_consulta: null,
    diagnostico: null,
    tratamiento: null,
    medicamentos_prescritos: null,
    indicaciones: null,
    proximo_control: null,
    peso_registro: null,
    temperatura: null,
    frecuencia_cardiaca: null,
    frecuencia_respiratoria: null,
    archivos: [],
    negocio: { id_negocio: 1, nombre: "Clínica Patitas" },
    empleado: null,
    registrado_por: null,
    fecha_creacion: "2026-10-14 10:00:00",
    edicion: null,
    ediciones: 0,
    ...cambios,
  } as RegistroHistorial;
}

// Handlers por defecto. Cada prueba agrega los suyos con server.use(...).
// Las pestañas abren Inicio, que pide las mascotas: por defecto, sin mascotas.
export const handlers = [
  http.get(`${API}/health`, () =>
    ok({ status: "ok", db: "ok", uptime: 42, time: "2026-11-18T13:00:00.000Z" }),
  ),
  http.get(`${API}/politica-datos`, () => ok({ version: "1.0", url: null })),
  http.get(`${API}/mascotas`, () => ok([])),
  http.get(`${API}/mascotas/:id/pesos`, () => ok({ peso_actual: null, puntos: [] })),
  http.get(`${API}/mascotas/:id/vacunas`, () => ok([])),
  http.get(`${API}/mascotas/:id/historial`, () =>
    HttpResponse.json({
      success: true,
      message: "OK",
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false },
    }),
  ),
];
