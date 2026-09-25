import express from "express";
import {
  sendInvitacion,
  resendInvitacion,
  acceptInvitacion
} from "./invitacion.controller.js";

import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { authorize } from "../../shared/middlewares/authorize.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Invitaciones
 *   description: Gestión de invitaciones de empleados
 */

/**
 * @swagger
 * /invitaciones/{id_empleado}/send:
 *   post:
 *     summary: Enviar invitación a empleado (Propietario o admin)
 *     description: Solo propietario o admin puede enviar invitaciones
 *     tags: [Invitaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_empleado
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del empleado
 *       - in: query
 *         name: id_negocio
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del negocio
 *     responses:
 *       200:
 *         description: Invitación enviada correctamente
 *         content:
 *           application/json:
 *             example:
 *               ok: true
 *               message: Invitación enviada correctamente
 *       400:
 *         description: Empleado inválido o ya tiene cuenta
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Empleado o negocio no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.post(
  "/:id_empleado/send",
  authMiddleware,
  authorize("empleados", "crear"),
  sendInvitacion
);



/**
 * @swagger
 * /invitaciones/{id_empleado}/resend:
 *   post:
 *     summary: Reenviar invitación (Propietario o admin)
 *     description: Invalida tokens anteriores y genera uno nuevo
 *     tags: [Invitaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_empleado
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: id_negocio
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Invitación reenviada correctamente
 *         content:
 *           application/json:
 *             example:
 *               ok: true
 *               message: Invitación reenviada correctamente
 *       400:
 *         description: Límite de reenvíos alcanzado
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Invitación no encontrada
 */
router.post(
  "/:id_empleado/resend",
  authMiddleware,
  authorize("empleados", "crear"),
  resendInvitacion
);


/**
 * @swagger
 * /invitaciones/accept-invitation:
 *   put:
 *     summary: Aceptar invitación de empleado
 *     description: Permite crear cuenta o vincular cuenta existente
 *     tags: [Invitaciones]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 example: "abc123token"
 *               password:
 *                 type: string
 *                 nullable: true
 *                 example: "123456"
 *               confirmar_password:
 *                 type: string
 *                 nullable: true
 *                 example: "123456"
 *               nombre:
 *                 type: string
 *                 example: Juan
 *               apellido:
 *                 type: string
 *                 example: Pérez
 *     responses:
 *       200:
 *         description: Invitación aceptada correctamente
 *         content:
 *           application/json:
 *             example:
 *               ok: true
 *               message: Cuenta creada y empleado vinculado correctamente
 *       400:
 *         description: Token inválido o expirado
 *       409:
 *         description: Invitación ya utilizada
 *       500:
 *         description: Error interno del servidor
 */
router.put("/accept-invitation", acceptInvitacion);

export default router;