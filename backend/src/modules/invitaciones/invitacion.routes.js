import express from "express";
import * as controller from "./invitacion.controller.js";
import { idEmpleadoParams } from "../empleados/empleado.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { authorize } from "../../shared/middlewares/authorize.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     InvitacionEnviada:
 *       type: object
 *       description: El token nunca aparece en la respuesta; solo viaja en el enlace del correo.
 *       properties:
 *         id_invitacion: { type: integer, example: 14 }
 *         email: { type: string, example: recepcionista@petcat.test }
 *         expiracion: { type: string, example: "2026-09-28 10:00:00", description: 72 horas después del envío }
 *         envios_restantes_24h: { type: integer, example: 3, description: Correos que aún se pueden enviar a ese email en 24 horas }
 *   responses:
 *     InvitacionConflict:
 *       description: >
 *         El empleado no tiene email, está inactivo o ya tiene cuenta; ya tiene una invitación vigente
 *         (enviar) o nunca se le invitó (reenviar); o se alcanzó el máximo de 4 correos al mismo email
 *         en 24 horas (el mensaje indica desde cuándo se puede volver a enviar).
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ErrorResponse' }
 *           example: { success: false, message: "El empleado ya tiene una invitación vigente: usa reenviar si no la recibió" }
 *     InvitacionCorreoFallido:
 *       description: El servidor de correo no respondió (tiempo límite de 10 s) o rechazó el envío. No se crea la invitación.
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ErrorResponse' }
 *           example: { success: false, message: "No se pudo enviar el correo de invitación. Intenta de nuevo en unos minutos" }
 */

/**
 * @swagger
 * /empleados/{id_empleado}/invitacion:
 *   post:
 *     summary: Enviar la invitación al empleado
 *     description: >
 *       Requiere `empleados.crear`. Envía al email del empleado un enlace
 *       `{FRONTEND_URL}/invitacion/{token}` válido 72 horas para crear su cuenta o vincular la que
 *       ya tiene. En la base se guarda solo el SHA-256 del token. Máximo 4 correos al mismo email
 *       en 24 horas, contando los reenvíos.
 *     tags: [Invitaciones]
 *     parameters:
 *       - { in: path, name: id_empleado, required: true, schema: { type: integer } }
 *     responses:
 *       201:
 *         description: Invitación enviada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Invitación enviada }
 *                 data: { $ref: '#/components/schemas/InvitacionEnviada' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/InvitacionConflict' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *       503: { $ref: '#/components/responses/InvitacionCorreoFallido' }
 */
router.post(
  "/empleados/:id_empleado/invitacion",
  authMiddleware,
  validate({ params: idEmpleadoParams }),
  authorize("empleados", "crear"),
  controller.enviarInvitacion
);

/**
 * @swagger
 * /empleados/{id_empleado}/invitacion/reenviar:
 *   post:
 *     summary: Reenviar la invitación
 *     description: >
 *       Requiere `empleados.crear`. Invalida la invitación vigente y envía una nueva (72 horas).
 *       409 si nunca se invitó a ese email (usar enviar) o si ya se enviaron 4 correos a ese email
 *       en las últimas 24 horas.
 *     tags: [Invitaciones]
 *     parameters:
 *       - { in: path, name: id_empleado, required: true, schema: { type: integer } }
 *     responses:
 *       201:
 *         description: Invitación reenviada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Invitación reenviada }
 *                 data: { $ref: '#/components/schemas/InvitacionEnviada' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/InvitacionConflict' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *       503: { $ref: '#/components/responses/InvitacionCorreoFallido' }
 */
router.post(
  "/empleados/:id_empleado/invitacion/reenviar",
  authMiddleware,
  validate({ params: idEmpleadoParams }),
  authorize("empleados", "crear"),
  controller.reenviarInvitacion
);

export default router;
