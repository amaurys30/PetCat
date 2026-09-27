import express from "express";
import * as controller from "./invitacion.controller.js";
import { aceptarBody, tokenParams } from "./invitacion.schemas.js";
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

/**
 * @swagger
 * components:
 *   responses:
 *     InvitacionNoUsable:
 *       description: >
 *         La invitación ya se usó, venció o fue reemplazada por una más reciente, o el empleado o el
 *         negocio ya no están activos, o el empleado ya tiene cuenta (un mensaje para cada caso).
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ErrorResponse' }
 *           example: { success: false, message: "La invitación venció o fue reemplazada por una más reciente: pide que te la reenvíen" }
 *
 * /invitaciones/{token}:
 *   get:
 *     summary: Consultar una invitación (público)
 *     description: >
 *       Para la pantalla del enlace del correo. Sin token de sesión. `cuenta_existente` indica si el
 *       email ya tiene cuenta: si es true, el panel pide la contraseña actual; si no, una nueva.
 *       Sujeto al límite estricto de solicitudes.
 *     tags: [Invitaciones]
 *     security: []
 *     parameters:
 *       - { in: path, name: token, required: true, schema: { type: string, pattern: "^[0-9a-f]{64}$" } }
 *     responses:
 *       200:
 *         description: Invitación válida
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
 *                     negocio:
 *                       type: object
 *                       properties:
 *                         id_negocio: { type: integer }
 *                         nombre: { type: string, example: Clínica Veterinaria Patitas }
 *                         logo_url: { type: string, nullable: true }
 *                     rol:
 *                       type: object
 *                       properties:
 *                         nombre: { type: string, example: Recepcionista }
 *                     empleado:
 *                       type: object
 *                       properties:
 *                         nombre: { type: string, example: Ana }
 *                         apellido: { type: string, example: Rodríguez }
 *                     email: { type: string, example: recepcionista@petcat.test }
 *                     expiracion: { type: string, example: "2026-09-28 10:00:00" }
 *                     cuenta_existente: { type: boolean }
 *                     requiere_aceptar_politica:
 *                       type: boolean
 *                       description: Sin cuenta, aceptar exige acepta_politica_datos true (mostrar la política y un check)
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/InvitacionNoUsable' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 */
router.get("/invitaciones/:token", validate({ params: tokenParams }), controller.consultarInvitacion);

/**
 * @swagger
 * /invitaciones/{token}/aceptar:
 *   post:
 *     summary: Aceptar una invitación (público)
 *     description: >
 *       Vincula la cuenta al empleado e inicia sesión (misma respuesta que el login).
 *       - Si el email ya tiene cuenta: `password` es su contraseña actual. Se aplican las reglas del
 *         login: un error suma al contador de intentos y tras 5 la cuenta se bloquea 15 minutos.
 *         `nombre`, `apellido` y `telefono` se ignoran.
 *       - Si no tiene cuenta: se crea con `password` (8 a 72 caracteres, con letra y número) y el
 *         email queda verificado. `nombre` y `apellido` son opcionales: por defecto, los del empleado.
 *         `acepta_politica_datos: true` es obligatorio: se guarda la autorización de datos (canal
 *         `invitacion`, con el negocio que invitó).
 *       - Con cuenta existente `acepta_politica_datos` es opcional; si se envía y no tenía una
 *         autorización vigente, se registra.
 *
 *       Todo ocurre en una transacción con la invitación bloqueada: el mismo enlace no se puede usar
 *       dos veces, ni siquiera en solicitudes simultáneas.
 *     tags: [Invitaciones]
 *     security: []
 *     parameters:
 *       - { in: path, name: token, required: true, schema: { type: string, pattern: "^[0-9a-f]{64}$" } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [password]
 *             properties:
 *               password: { type: string, example: Clave1234 }
 *               nombre: { type: string, minLength: 2, maxLength: 80 }
 *               apellido: { type: string, minLength: 2, maxLength: 80 }
 *               telefono: { type: string, example: "3004445566" }
 *               acepta_politica_datos:
 *                 type: boolean
 *                 enum: [true]
 *                 description: Obligatorio si el email no tiene cuenta (requiere_aceptar_politica en GET /invitaciones/{token})
 *     responses:
 *       200:
 *         description: Invitación aceptada y sesión iniciada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Invitación aceptada }
 *                 data: { $ref: '#/components/schemas/Sesion' }
 *       401:
 *         description: Contraseña actual incorrecta (cuenta existente)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { success: false, message: Contraseña incorrecta }
 *       403:
 *         description: La cuenta existente está bloqueada por intentos fallidos o desactivada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Invitación no utilizable (ver GET) o la cuenta ya está vinculada a otro empleado del negocio
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 */
router.post(
  "/invitaciones/:token/aceptar",
  validate({ params: tokenParams, body: aceptarBody }),
  controller.aceptarInvitacion
);

export default router;
