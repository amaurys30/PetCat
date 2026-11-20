import { http, HttpResponse } from "msw";

import type { Cita, HorariosLibres, RegistroHistorial, Vacuna } from "@/api/types";

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

/** Negocio de GET /negocios (búsqueda), con su sucursal cercana. */
export function negocioBusquedaDemo(
  cambios: Record<string, unknown> = {},
  sucursal: Record<string, unknown> = {},
) {
  return {
    id_negocio: 1,
    nombre: "Clínica Vet Sabanas",
    tipo: "veterinaria",
    descripcion: null,
    ciudad: "Sincelejo",
    logo_url: null,
    logo_miniatura_url: null,
    calificacion_promedio: 4.9,
    total_resenas: 128,
    verificado: true,
    destacado: false,
    confirmacion_automatica: false,
    distancia_km: 1.23,
    sucursal_cercana: {
      id_sucursal: 10,
      nombre: "Principal",
      direccion: "Cra. 25 #18-40",
      latitud: 9.3047,
      longitud: -75.3978,
      abierto_ahora: true,
      cierra_a: "19:00",
      abre_hoy_a: null,
      ...sucursal,
    },
    ...cambios,
  };
}

/** Perfil público de GET /negocios/:id. */
export function negocioPublicoDemo(cambios: Record<string, unknown> = {}) {
  return {
    id_negocio: 1,
    nombre: "Clínica Vet Sabanas",
    tipo: "veterinaria",
    descripcion: "Atención para perros y gatos.",
    telefono: "6052800000",
    whatsapp: "3001234567",
    email: null,
    sitio_web: null,
    direccion: "Cra. 25 #18-40",
    ciudad: "Sincelejo",
    departamento: "Sucre",
    latitud: 9.3047,
    longitud: -75.3978,
    logo_url: null,
    logo_miniatura_url: null,
    banner_url: null,
    calificacion_promedio: 4.9,
    total_resenas: 128,
    verificado: true,
    confirmacion_automatica: false,
    sucursales: [
      {
        id_sucursal: 10,
        id_negocio: 1,
        nombre: "Principal",
        descripcion: null,
        telefono: "6052800000",
        direccion: "Cra. 25 #18-40",
        ciudad: "Sincelejo",
        latitud: 9.3047,
        longitud: -75.3978,
        es_principal: true,
        horarios: [1, 2, 3, 4, 5].flatMap((d) => [
          { dia_semana: d, hora_apertura: "08:00", hora_cierre: "12:00" },
          { dia_semana: d, hora_apertura: "14:00", hora_cierre: "18:00" },
        ]),
      },
    ],
    servicios: [
      {
        id_servicio: 1,
        nombre: "Consulta general",
        descripcion: null,
        precio_base: 45000,
        precio_maximo: null,
        tipo_precio: "fijo",
        duracion_minutos: 30,
        tipo_mascota: ["perro", "gato"],
        en_oferta: false,
        precio_oferta: null,
        precio_actual: 45000,
        oferta_vigente: false,
        reservable: true,
        id_categoria: 1,
        categoria: "Consulta",
      },
      {
        id_servicio: 2,
        nombre: "Vacunación",
        descripcion: null,
        precio_base: 40000,
        precio_maximo: null,
        tipo_precio: "fijo",
        duracion_minutos: 15,
        tipo_mascota: ["perro"],
        en_oferta: true,
        precio_oferta: 38000,
        precio_actual: 38000,
        oferta_vigente: true,
        reservable: true,
        id_categoria: 2,
        categoria: "Vacunación",
      },
    ],
    resenas_recientes: [],
    ...cambios,
  };
}

/** Cita de la vista del dueño (GET /citas/mias, GET /citas/:id, POST /citas). */
export function citaDemo(cambios: Partial<Cita> = {}): Cita {
  return {
    id_cita: 50,
    fecha: "2026-11-18",
    hora_inicio: "08:30",
    hora_fin: "09:00",
    estado: "pendiente",
    origen: "app_movil",
    prioridad: "normal",
    precio_estimado: 45000,
    precio_final: null,
    notas_cliente: null,
    id_cita_origen: null,
    confirmar_antes_de: null,
    fecha_completada: null,
    id_resena: null,
    cancelacion: null,
    negocio: { id_negocio: 1, nombre: "Clínica Vet Sabanas", logo_url: null },
    sucursal: {
      id_sucursal: 10,
      nombre: "Principal",
      direccion: "Cra. 25 #18-40",
      telefono: "6052800000",
      latitud: 9.3047,
      longitud: -75.3978,
    },
    servicio: { id_servicio: 1, nombre: "Consulta general", duracion_minutos: 30 },
    empleado: { id_empleado: 3, nombre: "Carlos", apellido: "Pérez" },
    mascota: { id_mascota: 1, nombre: "Luna", especie: "perro" },
    cliente: { id_usuario: 7, nombre: "Ana", apellido: "Gómez", telefono: null },
    fecha_creacion: "2026-11-17 10:00:00",
    ...cambios,
  } as Cita;
}

/** Respuesta de GET /citas/horarios-libres con esas horas libres. */
export function horariosDemo(fecha: string, horas: string[], motivo: string | null = null): HorariosLibres {
  return {
    fecha,
    servicio: { id_servicio: 1, nombre: "Consulta general", duracion_minutos: 30, precio_actual: 45000 },
    sucursal: { id_sucursal: 10, nombre: "Principal" },
    horarios: horas.map((h) => ({
      hora_inicio: h,
      hora_fin: h,
      empleados: [{ id_empleado: 3, nombre: "Carlos", apellido: "Pérez" }],
    })),
    motivo_sin_horarios: horas.length ? null : (motivo ?? "No hay horarios disponibles para esa fecha"),
  } as HorariosLibres;
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
  http.get(`${API}/negocios`, () =>
    HttpResponse.json({
      success: true,
      message: "OK",
      data: [],
      meta: { total: 0, page: 1, limit: 100, totalPages: 0, hasNext: false },
    }),
  ),
  http.get(`${API}/mascotas/:id/historial`, () =>
    HttpResponse.json({
      success: true,
      message: "OK",
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false },
    }),
  ),
];
