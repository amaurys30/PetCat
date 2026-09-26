import express from "express";
import * as controller from "./auth.controller.js";
import { registerBody, loginBody } from "./auth.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Usuario:
 *       type: object
 *       properties:
 *         id_usuario: { type: integer, example: 12 }
 *         nombre: { type: string, example: Sofía }
 *         apellido: { type: string, example: Gómez }
 *         email: { type: string, format: email, example: cliente@petcat.test }
 *         telefono: { type: string, nullable: true, example: "3003334455" }
 *         foto_url: { type: string, nullable: true }
 *         tipo_usuario: { type: string, enum: [cliente, negocio, admin] }
 *         email_verificado: { type: boolean }
 *     Sesion:
 *       type: object
 *       properties:
 *         access_token:
 *           type: string
 *           description: JWT para `Authorization Bearer`. Vigencia JWT_EXPIRES_IN (1 h por defecto).
 *         refresh_token:
 *           type: string
 *           description: Vigencia REFRESH_EXPIRES_IN (7 días por defecto); la sesión vence con él.
 *         usuario: { $ref: '#/components/schemas/Usuario' }
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Crear una cuenta
 *     description: >
 *       Registro público para dueños de mascotas (`cliente`) y dueños de negocio (`negocio`).
 *       No permite crear administradores de plataforma. No inicia sesión: después se llama a `/auth/login`.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [nombre, apellido, email, password]
 *             properties:
 *               nombre: { type: string, minLength: 2, maxLength: 80, example: Sofía }
 *               apellido: { type: string, minLength: 2, maxLength: 80, example: Gómez }
 *               email: { type: string, format: email, maxLength: 150, example: sofia@correo.com }
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 72
 *                 description: Al menos una letra y un número.
 *                 example: Petcat123!
 *               telefono: { type: string, example: "3003334455" }
 *               tipo_usuario: { type: string, enum: [cliente, negocio], default: cliente }
 *     responses:
 *       201:
 *         description: Cuenta creada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Cuenta creada }
 *                 data: { $ref: '#/components/schemas/Usuario' }
 *       409:
 *         description: Ya existe una cuenta con ese correo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { success: false, message: Ya existe una cuenta con ese correo, errors: { email: Ya está registrado } }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post("/register", validate({ body: registerBody }), controller.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     description: >
 *       Devuelve access token, refresh token y el perfil del usuario, y registra la sesión
 *       (IP y user agent). Tras 5 intentos fallidos seguidos la cuenta se bloquea 15 minutos;
 *       un inicio de sesión correcto reinicia el contador.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: propietario@petcat.test }
 *               password: { type: string, example: Petcat123! }
 *               dispositivo: { type: string, maxLength: 200, example: web, description: Nombre del dispositivo o cliente (opcional) }
 *     responses:
 *       200:
 *         description: Sesión iniciada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Sesión iniciada }
 *                 data: { $ref: '#/components/schemas/Sesion' }
 *       401:
 *         description: Email inexistente o contraseña errónea (mismo mensaje en ambos casos)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { success: false, message: Credenciales inválidas }
 *       403:
 *         description: Cuenta desactivada o bloqueada por intentos fallidos
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { success: false, message: Cuenta bloqueada por demasiados intentos fallidos. Intenta de nuevo en 15 minutos }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 */
router.post("/login", validate({ body: loginBody }), controller.login);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Cerrar sesión
 *     description: Cierra solo la sesión del access token enviado; las demás sesiones del usuario siguen activas.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Sesión cerrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Sesión cerrada }
 *                 data: { nullable: true, example: null }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: La cuenta está desactivada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post("/logout", authMiddleware, controller.logout);

export default router;
