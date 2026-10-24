import express from "express";
import * as controller from "./suscripcion.controller.js";
import { asignarPlanBody } from "./suscripcion.schemas.js";
import { idNegocioParams } from "../negocios/negocio.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { authorize, soloAdmin } from "../../shared/middlewares/authorize.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Plan:
 *       type: object
 *       properties:
 *         id_plan: { type: integer, example: 2 }
 *         nombre: { type: string, example: Pro }
 *         descripcion: { type: string, nullable: true }
 *         precio_mensual: { type: number, example: 120000 }
 *         precio_anual: { type: number, example: 1080000 }
 *         limites:
 *           type: object
 *           description: "-1 = ilimitado"
 *           properties:
 *             sucursales: { type: integer, example: 3 }
 *             empleados: { type: integer, example: -1 }
 *             citas_mes: { type: integer, example: -1 }
 *             productos: { type: integer, example: -1 }
 *         caracteristicas:
 *           type: object
 *           properties:
 *             estadisticas_avanzadas: { type: boolean }
 *             soporte_prioritario: { type: boolean }
 *             integracion_whatsapp: { type: boolean }
 *             exportar_informes: { type: boolean }
 *             ia_recomendaciones: { type: boolean }
 *             api_personalizada: { type: boolean }
 *             dominio_personalizado: { type: boolean }
 *             gestor_dedicado: { type: boolean }
 *             sla_garantizado: { type: boolean }
 *             capacitacion_incluida: { type: boolean }
 *     UsoLimite:
 *       type: object
 *       properties:
 *         usadas: { type: integer, example: 1 }
 *         maximo: { type: integer, description: "-1 = ilimitado", example: 1 }
 *     Suscripcion:
 *       type: object
 *       properties:
 *         plan:
 *           allOf:
 *             - $ref: '#/components/schemas/Plan'
 *           description: >
 *             Plan efectivo: el de la suscripción vigente, o el Gratuito si venció (la
 *             prueba o el plan pago) o si no hay ninguna. Sus límites son los que se aplican.
 *         suscripcion:
 *           type: object
 *           nullable: true
 *           description: Suscripción vigente (la más reciente activa o en prueba)
 *           properties:
 *             id_suscripcion: { type: integer }
 *             plan:
 *               type: object
 *               description: Plan contratado (puede diferir del efectivo si venció)
 *               properties:
 *                 id_plan: { type: integer }
 *                 nombre: { type: string, example: Pro }
 *             estado: { type: string, enum: [activa, en_prueba, vencida] }
 *             tipo_facturacion: { type: string, enum: [mensual, anual] }
 *             fecha_inicio: { type: string, example: "2026-09-28" }
 *             fecha_fin: { type: string, example: "2026-10-12", description: "9999-12-31 = sin vencimiento" }
 *             fecha_prueba_fin: { type: string, nullable: true, example: "2026-10-12" }
 *             dias_prueba_restantes: { type: integer, nullable: true, example: 14, description: Solo en prueba vigente }
 *             auto_renovar: { type: boolean }
 *             monto_pagado: { type: number }
 *         prueba_disponible:
 *           type: boolean
 *           description: Está en el plan Gratuito y nunca usó la prueba Pro
 *         uso:
 *           type: object
 *           properties:
 *             sucursales: { $ref: '#/components/schemas/UsoLimite' }
 *             empleados:
 *               allOf:
 *                 - $ref: '#/components/schemas/UsoLimite'
 *               description: Activos, sin contar al propietario registrado como empleado
 *             citas_mes:
 *               allOf:
 *                 - $ref: '#/components/schemas/UsoLimite'
 *                 - type: object
 *                   properties:
 *                     mes: { type: string, example: "2026-09" }
 *               description: Citas con fecha en el mes actual, excepto canceladas y reprogramadas
 *             productos: { $ref: '#/components/schemas/UsoLimite' }
 *         soporte:
 *           type: object
 *           description: >
 *             Contacto de PetCat para contratar o cambiar de plan mientras no hay pagos en línea
 *             (`soporte_email` y `soporte_whatsapp` de la configuración global). Sin configurar, null.
 *           properties:
 *             email: { type: string, nullable: true, example: soporte@petcat.com.co }
 *             whatsapp: { type: string, nullable: true, example: "+57 300 123 4567" }
 */

/**
 * @swagger
 * /planes:
 *   get:
 *     summary: Planes de suscripción
 *     description: Planes activos en orden de presentación. No requiere token.
 *     tags: [Planes y suscripciones]
 *     security: []
 *     responses:
 *       200:
 *         description: Lista de planes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Plan' } }
 */
router.get("/planes", controller.getPlanes);

/**
 * @swagger
 * /negocios/{id_negocio}/suscripcion:
 *   get:
 *     summary: Plan y suscripción del negocio, con el uso de cada límite
 *     description: Requiere `configuracion.ver` (el propietario siempre puede).
 *     tags: [Planes y suscripciones]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Suscripción
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { $ref: '#/components/schemas/Suscripcion' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   put:
 *     summary: Asignar un plan al negocio (admin de plataforma)
 *     description: >
 *       Solo el admin de plataforma, mientras no hay pasarela de pagos. Cierra la
 *       suscripción vigente y crea una activa desde hoy. Sin `fecha_fin`, dura un mes o
 *       un año según `tipo_facturacion`; el plan Gratuito no vence (no acepta `fecha_fin`).
 *     tags: [Planes y suscripciones]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [id_plan]
 *             properties:
 *               id_plan: { type: integer, example: 2 }
 *               tipo_facturacion: { type: string, enum: [mensual, anual], default: mensual }
 *               fecha_fin: { type: string, format: date, description: Futura. Por defecto, un mes o un año }
 *               monto_pagado: { type: number, minimum: 0, default: 0 }
 *               notas: { type: string, maxLength: 300 }
 *     responses:
 *       200:
 *         description: Plan asignado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Plan asignado }
 *                 data: { $ref: '#/components/schemas/Suscripcion' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/negocios/:id_negocio/suscripcion",
  authMiddleware,
  validate({ params: idNegocioParams }),
  authorize("configuracion", "ver"),
  controller.getSuscripcion
);

router.put(
  "/negocios/:id_negocio/suscripcion",
  authMiddleware,
  validate({ params: idNegocioParams, body: asignarPlanBody }),
  soloAdmin,
  controller.asignarPlan
);

/**
 * @swagger
 * /negocios/{id_negocio}/suscripcion/prueba-pro:
 *   post:
 *     summary: Activar la prueba gratuita del plan Pro
 *     description: >
 *       Solo el propietario del negocio (y el admin de plataforma). Una vez por negocio
 *       y solo desde el plan Gratuito. Dura `dias_prueba_gratis` días (14); al vencer,
 *       el negocio vuelve a los límites del Gratuito sin que se desactive nada.
 *     tags: [Planes y suscripciones]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *     responses:
 *       201:
 *         description: Prueba activada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Prueba del plan Pro activada }
 *                 data: { $ref: '#/components/schemas/Suscripcion' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Ya usó la prueba o ya tiene un plan pago
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { success: false, message: El negocio ya usó su prueba gratuita del plan Pro }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  "/negocios/:id_negocio/suscripcion/prueba-pro",
  authMiddleware,
  validate({ params: idNegocioParams }),
  authorize("configuracion", "editar"),
  controller.iniciarPrueba
);

export default router;
