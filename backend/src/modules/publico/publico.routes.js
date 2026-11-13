import express from "express";
import * as controller from "./publico.controller.js";
import { resenasQuery } from "./publico.schemas.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Público
 *     description: >
 *       Datos de la página de presentación (landing), sin token. Solo información agregada o ya
 *       pública; las respuestas se guardan en caché 5 minutos (también `Cache-Control`).
 * components:
 *   schemas:
 *     EstadisticasPublicas:
 *       type: object
 *       description: >
 *         Cada cifra es null si no supera `configuracion_global.publico_umbral_cifras` (5): con
 *         pocos datos la landing no la muestra.
 *       properties:
 *         negocios_activos: { type: integer, nullable: true, example: 12, description: Negocios activos con al menos una sucursal activa }
 *         ciudades: { type: integer, nullable: true, example: null, description: Ciudades distintas de sus sucursales activas }
 *         citas_atendidas: { type: integer, nullable: true, example: 340, description: Citas completadas }
 *     ResenaLanding:
 *       type: object
 *       properties:
 *         id_resena: { type: integer }
 *         calificacion: { type: integer, enum: [4, 5] }
 *         titulo: { type: string, nullable: true }
 *         comentario: { type: string }
 *         autor: { type: string, example: Sofía G., description: Nombre e inicial del apellido }
 *         negocio:
 *           type: object
 *           properties:
 *             id_negocio: { type: integer }
 *             nombre: { type: string }
 *             tipo: { type: string }
 *         visita_verificada: { type: string, example: "2026-09", description: Mes y año de la cita reseñada }
 *     ConfiguracionPublica:
 *       type: object
 *       properties:
 *         soporte:
 *           type: object
 *           description: "`soporte_email` y `soporte_whatsapp` de la configuración global; vacío = null"
 *           properties:
 *             email: { type: string, nullable: true, example: soporte@petcat.com.co }
 *             whatsapp: { type: string, nullable: true, example: "+57 300 123 4567" }
 *         prueba_pro_dias: { type: integer, example: 14, description: "Días de la prueba del plan Pro (dias_prueba_gratis)" }
 */

/**
 * @swagger
 * /publico/estadisticas:
 *   get:
 *     summary: Cifras de la plataforma (landing)
 *     description: >
 *       Público. Conteos agregados, sin datos personales: negocios activos, ciudades y citas
 *       atendidas. Cada cifra que no supera el umbral llega en null.
 *     tags: [Público]
 *     security: []
 *     responses:
 *       200:
 *         description: Cifras
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { $ref: '#/components/schemas/EstadisticasPublicas' }
 */
router.get("/publico/estadisticas", controller.getEstadisticas);

/**
 * @swagger
 * /publico/resenas:
 *   get:
 *     summary: Reseñas destacadas (landing)
 *     description: >
 *       Público. Reseñas de 4 y 5 estrellas con comentario, de una cita completada, visibles, sin
 *       reporte y de negocios activos; nunca las ocultas, reportadas o retiradas, ni las de un
 *       cliente que el mismo negocio registró desde el panel. Las más recientes, como máximo 2 por
 *       negocio. Si hay menos de `configuracion_global.publico_min_resenas` (3) elegibles, la lista
 *       llega vacía y la landing no muestra la sección.
 *     tags: [Público]
 *     security: []
 *     parameters:
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 12, default: 6 } }
 *     responses:
 *       200:
 *         description: Reseñas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { type: array, items: { $ref: '#/components/schemas/ResenaLanding' } }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get("/publico/resenas", validate({ query: resenasQuery }), controller.getResenas);

/**
 * @swagger
 * /publico/configuracion:
 *   get:
 *     summary: Contacto de soporte y prueba Pro (landing)
 *     description: Público. Contacto de soporte de PetCat y duración de la prueba del plan Pro.
 *     tags: [Público]
 *     security: []
 *     responses:
 *       200:
 *         description: Configuración pública
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { $ref: '#/components/schemas/ConfiguracionPublica' }
 */
router.get("/publico/configuracion", controller.getConfiguracion);

export default router;
