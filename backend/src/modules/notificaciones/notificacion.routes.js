import express from "express";
import * as controller from "./notificacion.controller.js";

const router = express.Router();

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
