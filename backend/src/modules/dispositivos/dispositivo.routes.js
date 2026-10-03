import express from "express";
import * as controller from "./dispositivo.controller.js";
import { quitarDispositivoBody, registrarDispositivoBody } from "./dispositivo.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Dispositivo:
 *       type: object
 *       properties:
 *         id_dispositivo: { type: integer }
 *         token_expo: { type: string, example: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }
 *         plataforma: { type: string, enum: [ios, android] }
 *         nombre: { type: string, nullable: true, example: Galaxy A54 }
 *         activo: { type: boolean }
 *         fecha_registro: { type: string, example: "2026-09-28 10:00:00" }
 */

/**
 * @swagger
 * /dispositivos:
 *   post:
 *     summary: Registrar el dispositivo para recibir push (app)
 *     description: >
 *       La app envía su token de Expo Push después de iniciar sesión (y cada vez que el token cambie).
 *       Queda ligado a la sesión: al cerrar sesión, cambiar o restablecer la contraseña, deja de recibir
 *       push. Si el token ya estaba registrado (otra sesión u otra cuenta en el mismo teléfono) pasa a esta
 *       sesión y responde 200; si es nuevo, 201.
 *     tags: [Notificaciones]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [token_expo, plataforma]
 *             properties:
 *               token_expo: { type: string, example: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }
 *               plataforma: { type: string, enum: [ios, android] }
 *               nombre: { type: string, maxLength: 100, description: Modelo del teléfono }
 *     responses:
 *       201:
 *         description: Dispositivo registrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Dispositivo registrado }
 *                 data: { $ref: '#/components/schemas/Dispositivo' }
 *       200:
 *         description: El token ya existía y quedó en esta sesión
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Dispositivo actualizado }
 *                 data: { $ref: '#/components/schemas/Dispositivo' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   delete:
 *     summary: Dejar de recibir push en este dispositivo (app)
 *     description: >
 *       Desactiva el token (p. ej. si el usuario apaga las notificaciones en la app). No hace falta
 *       llamarlo al cerrar sesión: el logout ya desactiva el dispositivo de la sesión.
 *     tags: [Notificaciones]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [token_expo]
 *             properties:
 *               token_expo: { type: string }
 *     responses:
 *       200:
 *         description: Dispositivo eliminado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Dispositivo eliminado }
 *                 data: { nullable: true, example: null }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404:
 *         description: El usuario no tiene un dispositivo activo con ese token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post("/dispositivos", authMiddleware, validate({ body: registrarDispositivoBody }), controller.registrar);
router.delete("/dispositivos", authMiddleware, validate({ body: quitarDispositivoBody }), controller.quitar);

export default router;
