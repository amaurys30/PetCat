import type { Dashboard, SeccionBloqueada } from "@/api/dashboard";
import { hoyISO } from "@/lib/format";

const porEstado = (cambios: Partial<Dashboard["citas"]["por_estado"]> = {}) => ({
  pendiente: 0,
  confirmada: 0,
  en_curso: 0,
  completada: 0,
  cancelada: 0,
  no_asistio: 0,
  reprogramada: 0,
  ...cambios,
});

const bloqueada: SeccionBloqueada = {
  bloqueado: true,
  plan_requerido: { id_plan: 2, nombre: "Pro", precio_mensual: 120000 },
};

/** `GET /negocios/1/dashboard` de un negocio Gratuito (secciones avanzadas bloqueadas). */
export const dashboardGratuito = (cambios: Partial<Dashboard> = {}): Dashboard => ({
  periodo: { desde: "2026-09-24", hasta: hoyISO(), dias: 30 },
  id_sucursal: null,
  plan: { id_plan: 1, nombre: "Gratuito", estadisticas_avanzadas: false, rango_maximo_dias: 92 },
  prueba_disponible: true,
  hoy: { fecha: hoyISO(), total: 4, por_estado: porEstado({ confirmada: 4 }), por_confirmar: 3 },
  citas: { total: 15, por_estado: porEstado({ completada: 6, no_asistio: 2, cancelada: 3 }) },
  tasa_inasistencia: { porcentaje: 25, inasistencias: 2, base: 8 },
  ingresos: {
    total: 343000,
    citas_completadas: 6,
    ticket_promedio: 57166.67,
    moneda: "COP",
    origen: "citas_completadas",
    verificado: false,
    nota: "Suma del precio final que el negocio registró al completar cada cita. No son pagos verificados.",
  },
  servicios_mas_pedidos: [
    { id_servicio: 1, nombre: "Consulta general", completadas: 5, ingresos: 305000 },
    { id_servicio: 2, nombre: "Vacuna antirrábica", completadas: 1, ingresos: 38000 },
  ],
  clientes_nuevos: 2,
  calificacion: {
    promedio: 4.7,
    total_resenas: 38,
    resenas_periodo: 2,
    promedio_periodo: 4.5,
    sin_responder: 2,
  },
  vacunas_vencidas: { mascotas: 5, dias: 30, desde: "2026-09-23", hasta: "2026-10-22" },
  citas_perdidas_por_no_confirmar: {
    total: 2,
    sugerencia: {
      codigo: "activar_confirmacion_automatica",
      mensaje:
        "2 citas se cancelaron porque nadie las confirmó a tiempo. Con la confirmación automática, las reservas de la app quedan confirmadas al instante.",
    },
  },
  avanzadas: {
    tendencia: bloqueada,
    comparacion: bloqueada,
    por_empleado: bloqueada,
    por_sucursal: bloqueada,
    horas_pico: bloqueada,
    recurrencia: bloqueada,
    cancelaciones: bloqueada,
  },
  ...cambios,
});

/** El mismo negocio con estadísticas avanzadas (Pro). */
export const dashboardPro = (cambios: Partial<Dashboard> = {}): Dashboard =>
  dashboardGratuito({
    plan: { id_plan: 2, nombre: "Pro", estadisticas_avanzadas: true, rango_maximo_dias: 366 },
    prueba_disponible: false,
    citas_perdidas_por_no_confirmar: { total: 0, sugerencia: null },
    avanzadas: {
      tendencia: {
        agrupacion: "semana",
        puntos: [
          { inicio: "2026-09-21", citas: 4, completadas: 3, ingresos: 150000 },
          { inicio: "2026-09-28", citas: 6, completadas: 5, ingresos: 290000 },
        ],
      },
      comparacion: {
        periodo_anterior: { desde: "2026-08-25", hasta: "2026-09-23" },
        actual: { citas: 15, completadas: 6, ingresos: 343000, clientes_nuevos: 2, tasa_inasistencia: 6 },
        anterior: { citas: 12, completadas: 5, ingresos: 306250, clientes_nuevos: 2, tasa_inasistencia: 8 },
        variacion_pct: {
          citas: 25,
          completadas: 18,
          ingresos: 12,
          clientes_nuevos: 0,
          tasa_inasistencia: -25,
        },
      },
      por_empleado: [
        {
          empleado: { id_empleado: 1, nombre: "Carlos", apellido: "Martínez" },
          citas: 9,
          completadas: 8,
          ingresos: 930000,
          inasistencias: 1,
        },
        { empleado: null, citas: 1, completadas: 1, ingresos: 50000, inasistencias: 0 },
      ],
      por_sucursal: [
        {
          sucursal: { id_sucursal: 3, nombre: "Sede Centro" },
          citas: 10,
          completadas: 9,
          ingresos: 980000,
          inasistencias: 1,
        },
      ],
      horas_pico: [{ dia_semana: 2, hora: 9, citas: 4 }],
      recurrencia: { clientes: 4, recurrentes: 1, porcentaje: 25 },
      cancelaciones: { total: 3, por_dueno: 1, por_negocio: 0, por_sistema: 2, tardias: 1 },
    },
    ...cambios,
  });
