import express from "express";
import * as controller from "./notificacion.controller.js";
import { destinoQuery, idNotificacionParams, listNotificacionesQuery } from "./notificacion.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Notificacion:
 *       type: object
 *       description: >
 *         También llega en tiempo real por Socket.IO (evento `notificacion`, misma forma). Ver README,
 *         "Notificaciones en tiempo real".
 *       properties:
 *         id_notificacion: { type: integer, example: 120 }
 *         id_negocio: { type: integer, nullable: true }
 *         destino:
 *           type: string
 *           enum: [dueno, negocio]
 *           description: >
 *             A quién va: `dueno` (la app del dueño de la mascota) o `negocio` (el panel). Un usuario que es
 *             dueño y personal de un negocio recibe las dos; cada cliente pide las suyas con `?destino=`.
 *         tipo:
 *           type: string
 *           enum: [cita_nueva, cita_agendada, cita_confirmada, cita_cancelada, cita_reprogramada, cita_por_confirmar, cita_no_confirmada, cita_dia_anterior, cita_recordatorio, resena_invitacion, resena_nueva, resena_respondida, vacuna_proxima, vacuna_vence_hoy, vacuna_vencida, plan_prueba_por_vencer, plan_vencido, plan_limite_alcanzado, plan_limite_80]
 *         titulo: { type: string, example: Cita cancelada }
 *         mensaje: { type: string, description: El detalle (solo se ve con la sesión iniciada) }
 *         datos:
 *           type: object
 *           description: >
 *             Ids para abrir la pantalla correspondiente (deep link). Las de citas traen `id_cita`, `id_negocio`
 *             y la `fecha` de la cita; `cita_nueva` también `por_confirmar` (false si nació confirmada por la
 *             confirmación automática). `resena_nueva` trae `id_resena`; las del plan, `id_negocio`.
 *           properties:
 *             tipo: { type: string, example: cita_nueva }
 *             id_cita: { type: integer, x-opcional: true, example: 77 }
 *             id_negocio: { type: integer, x-opcional: true, example: 1 }
 *             fecha: { type: string, format: date, x-opcional: true, example: "2026-10-28" }
 *             por_confirmar: { type: boolean, x-opcional: true }
 *             id_resena: { type: integer, x-opcional: true }
 *             id_mascota: { type: integer, x-opcional: true }
 *             id_vacuna: { type: integer, x-opcional: true }
 *             mes: { type: string, x-opcional: true, example: "2026-10" }
 *         leida: { type: boolean }
 *         leida_en: { type: string, nullable: true }
 *         fecha_creacion: { type: string, example: "2026-09-28 10:15:00" }
 *     NoLeidasPorDestino:
 *       type: object
 *       properties:
 *         dueno: { type: integer, example: 1, description: De la app del dueño }
 *         negocio: { type: integer, example: 2, description: Del panel }
 *   parameters:
 *     destinoNotificacion:
 *       in: query
 *       name: destino
 *       schema: { type: string, enum: [dueno, negocio] }
 *       description: Solo las de la app del dueño o solo las del panel; sin él, todas
 */

/**
 * @swagger
 * /notificaciones:
 *   get:
 *     summary: Mis notificaciones
 *     description: >
 *       Del usuario autenticado, las más recientes primero. La app pide `destino=dueno` y el panel
 *       `destino=negocio`; sin `destino`, todas. `meta.no_leidas` (del mismo destino) para el globo.
 *     tags: [Notificaciones]
 *     parameters:
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - $ref: '#/components/parameters/destinoNotificacion'
 *       - { in: query, name: leidas, schema: { type: string, enum: ["true", "false"] }, description: "Sin filtro, todas" }
 *     responses:
 *       200:
 *         description: Página de notificaciones
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Notificacion' } }
 *                 meta:
 *                   allOf:
 *                     - $ref: '#/components/schemas/PaginationMeta'
 *                     - type: object
 *                       properties:
 *                         no_leidas: { type: integer, example: 3, description: "Del destino pedido (sin destino, todas)" }
 *                         no_leidas_por_destino: { $ref: '#/components/schemas/NoLeidasPorDestino' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get("/notificaciones", authMiddleware, validate({ query: listNotificacionesQuery }), controller.getNotificaciones);

/**
 * @swagger
 * /notificaciones/no-leidas:
 *   get:
 *     summary: Cantidad de notificaciones no leídas
 *     tags: [Notificaciones]
 *     parameters:
 *       - $ref: '#/components/parameters/destinoNotificacion'
 *     responses:
 *       200:
 *         description: Total
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data:
 *                   type: object
 *                   properties:
 *                     total: { type: integer, example: 3, description: "Del destino pedido (sin destino, todas)" }
 *                     por_destino: { $ref: '#/components/schemas/NoLeidasPorDestino' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get("/notificaciones/no-leidas", authMiddleware, validate({ query: destinoQuery }), controller.getNoLeidas);

/**
 * @swagger
 * /notificaciones/leer-todas:
 *   post:
 *     summary: Marcar todas mis notificaciones como leídas
 *     description: >
 *       Con `destino`, solo las de ese destino (el panel no marca las de la app). Las demás sesiones
 *       conectadas reciben por Socket.IO `notificaciones_leidas` con `{ no_leidas, por_destino }`.
 *     tags: [Notificaciones]
 *     parameters:
 *       - $ref: '#/components/parameters/destinoNotificacion'
 *     responses:
 *       200:
 *         description: Cuántas se marcaron
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Notificaciones leídas }
 *                 data: { type: object, properties: { actualizadas: { type: integer, example: 3 } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post("/notificaciones/leer-todas", authMiddleware, validate({ query: destinoQuery }), controller.marcarTodasLeidas);

/**
 * @swagger
 * /notificaciones/{id_notificacion}/leida:
 *   patch:
 *     summary: Marcar una notificación como leída
 *     description: Si ya estaba leída, la devuelve igual. De otro usuario o inexistente, 404.
 *     tags: [Notificaciones]
 *     parameters:
 *       - { in: path, name: id_notificacion, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Notificación leída
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Notificación leída }
 *                 data: { $ref: '#/components/schemas/Notificacion' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.patch(
  "/notificaciones/:id_notificacion/leida",
  authMiddleware,
  validate({ params: idNotificacionParams }),
  controller.marcarLeida
);

/**
 * @swagger
 * /correo/baja:
 *   get:
 *     summary: Página para dejar de recibir correos de notificaciones
 *     description: >
 *       Enlace "Dejar de recibir estos correos" de todo correo de notificación. Público (no pide sesión:
 *       los clientes sin app no tienen otra forma de hacerlo). Responde una página HTML con un botón que
 *       hace el POST. El token es un JWT firmado, sin vencimiento, que solo sirve para esto.
 *     tags: [Notificaciones]
 *     security: []
 *     parameters:
 *       - { in: query, name: token, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Página de confirmación
 *         content: { text/html: { schema: { type: string } } }
 *       400:
 *         description: Enlace no válido (página HTML)
 *         content: { text/html: { schema: { type: string } } }
 *   post:
 *     summary: Dejar de recibir correos de notificaciones
 *     description: >
 *       Pone `notif_email` en false para el usuario del token. Lo usa el botón de la página y el
 *       "anular suscripción" de un clic de los clientes de correo (cabeceras List-Unsubscribe y
 *       List-Unsubscribe-Post, RFC 8058). Responde HTML.
 *     tags: [Notificaciones]
 *     security: []
 *     parameters:
 *       - { in: query, name: token, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Correos desactivados (página HTML)
 *         content: { text/html: { schema: { type: string } } }
 *       400:
 *         description: Enlace no válido (página HTML)
 *         content: { text/html: { schema: { type: string } } }
 */
router.get("/correo/baja", controller.confirmarBaja);
router.post("/correo/baja", controller.darDeBaja);

export default router;
