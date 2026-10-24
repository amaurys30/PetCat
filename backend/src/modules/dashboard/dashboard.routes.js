import express from "express";
import * as controller from "./dashboard.controller.js";
import { dashboardQuery } from "./dashboard.schemas.js";
import { idNegocioParams } from "../negocios/negocio.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { authorize } from "../../shared/middlewares/authorize.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     CitasPorEstado:
 *       type: object
 *       properties:
 *         pendiente: { type: integer }
 *         confirmada: { type: integer }
 *         en_curso: { type: integer }
 *         completada: { type: integer }
 *         cancelada: { type: integer }
 *         no_asistio: { type: integer }
 *         reprogramada: { type: integer }
 *     SeccionBloqueada:
 *       type: object
 *       description: Sección avanzada en un plan sin estadísticas avanzadas. No trae datos; el panel la muestra como invitación a mejorar el plan.
 *       properties:
 *         bloqueado: { type: boolean, example: true }
 *         plan_requerido:
 *           type: object
 *           nullable: true
 *           description: El plan activo más barato con estadísticas avanzadas
 *           properties:
 *             id_plan: { type: integer, example: 2 }
 *             nombre: { type: string, example: Pro }
 *             precio_mensual: { type: number, example: 120000 }
 *     DesempenoFila:
 *       type: object
 *       properties:
 *         citas: { type: integer, description: Sin canceladas ni reprogramadas }
 *         completadas: { type: integer }
 *         ingresos: { type: number }
 *         inasistencias: { type: integer }
 *     MetricasComparables:
 *       type: object
 *       properties:
 *         citas: { type: integer }
 *         completadas: { type: integer }
 *         ingresos: { type: number }
 *         clientes_nuevos: { type: integer }
 *         tasa_inasistencia: { type: number, nullable: true }
 *     Dashboard:
 *       type: object
 *       properties:
 *         periodo:
 *           type: object
 *           properties:
 *             desde: { type: string, format: date }
 *             hasta: { type: string, format: date }
 *             dias: { type: integer }
 *         id_sucursal: { type: integer, nullable: true }
 *         plan:
 *           type: object
 *           properties:
 *             id_plan: { type: integer }
 *             nombre: { type: string, example: Gratuito }
 *             estadisticas_avanzadas: { type: boolean }
 *             rango_maximo_dias: { type: integer, enum: [92, 366] }
 *         prueba_disponible: { type: boolean, description: 'El negocio puede activar la prueba Pro: el panel ofrece "Probar Pro 14 días" en lugar de "Mejorar plan"' }
 *         hoy:
 *           type: object
 *           description: Citas de hoy, sin importar el rango
 *           properties:
 *             fecha: { type: string, format: date }
 *             total: { type: integer, description: Sin reprogramadas }
 *             por_estado: { $ref: '#/components/schemas/CitasPorEstado' }
 *             por_confirmar: { type: integer, description: Pendientes desde hoy que esperan confirmación }
 *         citas:
 *           type: object
 *           properties:
 *             total: { type: integer, description: Sin reprogramadas (la cita nueva de una reprogramación ya cuenta) }
 *             por_estado: { $ref: '#/components/schemas/CitasPorEstado' }
 *         tasa_inasistencia:
 *           type: object
 *           properties:
 *             porcentaje: { type: number, nullable: true, example: 8.3, description: "inasistencias / base × 100; null sin base" }
 *             inasistencias: { type: integer }
 *             base: { type: integer, description: Completadas más inasistencias }
 *         ingresos:
 *           type: object
 *           description: Ingresos **registrados** por el negocio, no pagos verificados (hasta la Fase 3)
 *           properties:
 *             total: { type: number, example: 1850000 }
 *             citas_completadas: { type: integer }
 *             ticket_promedio: { type: number, nullable: true }
 *             moneda: { type: string, example: COP }
 *             origen: { type: string, example: citas_completadas }
 *             verificado: { type: boolean, example: false }
 *             nota: { type: string }
 *         servicios_mas_pedidos:
 *           type: array
 *           maxItems: 5
 *           items:
 *             type: object
 *             properties:
 *               id_servicio: { type: integer }
 *               nombre: { type: string }
 *               completadas: { type: integer }
 *               ingresos: { type: number }
 *         clientes_nuevos: { type: integer, description: "Primera cita o registro desde el panel en el periodo (todo el negocio, sin filtro de sucursal)" }
 *         calificacion:
 *           type: object
 *           properties:
 *             promedio: { type: number }
 *             total_resenas: { type: integer }
 *             resenas_periodo: { type: integer }
 *             promedio_periodo: { type: number, nullable: true }
 *             sin_responder: { type: integer, description: "Reseñas visibles sin respuesta (todas, no solo del periodo)" }
 *         vacunas_vencidas:
 *           type: object
 *           description: >
 *             Mascotas activas y vivas de clientes del negocio (alguna cita o una autorización registrada
 *             por él) con una dosis cuya próxima aplicación venció en los últimos 30 días (de `desde` a
 *             `hasta`, ayer). No cuenta las dosis reemplazadas por una más reciente. No depende del rango ni
 *             de la sucursal del dashboard.
 *           properties:
 *             mascotas: { type: integer, example: 5 }
 *             dias: { type: integer, example: 30 }
 *             desde: { type: string, format: date }
 *             hasta: { type: string, format: date }
 *         citas_perdidas_por_no_confirmar:
 *           type: object
 *           description: Canceladas por el sistema porque nadie las confirmó a tiempo. Nunca cuentan contra los clientes.
 *           properties:
 *             total: { type: integer }
 *             sugerencia:
 *               type: object
 *               nullable: true
 *               description: Solo si hubo alguna y la confirmación automática está apagada
 *               properties:
 *                 codigo: { type: string, example: activar_confirmacion_automatica }
 *                 mensaje: { type: string }
 *         avanzadas:
 *           type: object
 *           description: >
 *             Requieren estadísticas avanzadas (Pro, Enterprise o la prueba Pro). Sin ellas, cada sección es
 *             `SeccionBloqueada`.
 *           properties:
 *             tendencia:
 *               oneOf:
 *                 - $ref: '#/components/schemas/SeccionBloqueada'
 *                 - type: object
 *                   properties:
 *                     agrupacion: { type: string, enum: [dia, semana, mes], description: "día hasta 31 días, semana (desde el lunes) hasta 92, mes en rangos mayores" }
 *                     puntos:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           inicio: { type: string, format: date }
 *                           citas: { type: integer }
 *                           completadas: { type: integer }
 *                           ingresos: { type: number }
 *             comparacion:
 *               oneOf:
 *                 - $ref: '#/components/schemas/SeccionBloqueada'
 *                 - type: object
 *                   properties:
 *                     periodo_anterior: { type: object, properties: { desde: { type: string, format: date }, hasta: { type: string, format: date } } }
 *                     actual: { $ref: '#/components/schemas/MetricasComparables' }
 *                     anterior: { $ref: '#/components/schemas/MetricasComparables' }
 *                     variacion_pct: { type: object, description: "Por métrica; null si el periodo anterior es 0" }
 *             por_empleado:
 *               oneOf:
 *                 - $ref: '#/components/schemas/SeccionBloqueada'
 *                 - type: array
 *                   items:
 *                     allOf:
 *                       - type: object
 *                         properties:
 *                           empleado: { type: object, nullable: true, description: null = sin asignar, properties: { id_empleado: { type: integer }, nombre: { type: string }, apellido: { type: string } } }
 *                       - $ref: '#/components/schemas/DesempenoFila'
 *             por_sucursal:
 *               oneOf:
 *                 - $ref: '#/components/schemas/SeccionBloqueada'
 *                 - type: array
 *                   items:
 *                     allOf:
 *                       - type: object
 *                         properties:
 *                           sucursal: { type: object, nullable: true, properties: { id_sucursal: { type: integer }, nombre: { type: string } } }
 *                       - $ref: '#/components/schemas/DesempenoFila'
 *             horas_pico:
 *               oneOf:
 *                 - $ref: '#/components/schemas/SeccionBloqueada'
 *                 - type: array
 *                   description: De la franja con más citas a la de menos (sin canceladas ni reprogramadas)
 *                   items:
 *                     type: object
 *                     properties:
 *                       dia_semana: { type: integer, description: 0 = domingo }
 *                       hora: { type: integer, example: 9 }
 *                       citas: { type: integer }
 *             recurrencia:
 *               oneOf:
 *                 - $ref: '#/components/schemas/SeccionBloqueada'
 *                 - type: object
 *                   properties:
 *                     clientes: { type: integer, description: Con alguna cita completada en el periodo }
 *                     recurrentes: { type: integer, description: Con dos o más }
 *                     porcentaje: { type: number, nullable: true }
 *             cancelaciones:
 *               oneOf:
 *                 - $ref: '#/components/schemas/SeccionBloqueada'
 *                 - type: object
 *                   properties:
 *                     total: { type: integer }
 *                     por_dueno: { type: integer }
 *                     por_negocio: { type: integer }
 *                     por_sistema: { type: integer }
 *                     tardias: { type: integer, description: Del dueño a menos de 2 horas }
 */

/**
 * @swagger
 * /negocios/{id_negocio}/dashboard:
 *   get:
 *     summary: Dashboard del negocio (panel)
 *     description: >
 *       Requiere `reportes.ver`. Periodo por fecha de la cita; por defecto los últimos 30 días hasta hoy;
 *       `hasta` no puede ser posterior a hoy. Rango máximo: 92 días en el plan Gratuito y 366 con estadísticas
 *       avanzadas; un Gratuito que pide más recibe 422 con `errors.plan_requerido` (invitación a Pro). Las
 *       secciones de `avanzadas` llegan como `{ bloqueado: true, plan_requerido }` sin estadísticas avanzadas.
 *       Los ingresos son los registrados al completar citas, no pagos verificados.
 *     tags: [Dashboard]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *       - { in: query, name: desde, schema: { type: string, format: date } }
 *       - { in: query, name: hasta, schema: { type: string, format: date } }
 *       - { in: query, name: id_sucursal, schema: { type: integer }, description: Solo esa sede (de este negocio, activa o no) }
 *     responses:
 *       200:
 *         description: Dashboard
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { $ref: '#/components/schemas/Dashboard' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422:
 *         description: Fechas inválidas, sucursal ajena o rango mayor al del plan
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example:
 *               success: false
 *               message: Tu plan Gratuito permite ver hasta 92 días
 *               errors: { hasta: El rango máximo es de 92 días, plan_requerido: Pro }
 */
router.get(
  "/negocios/:id_negocio/dashboard",
  authMiddleware,
  validate({ params: idNegocioParams, query: dashboardQuery }),
  authorize("reportes", "ver"),
  controller.getDashboard
);

export default router;
