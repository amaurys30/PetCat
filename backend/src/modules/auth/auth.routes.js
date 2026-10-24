import express from "express";
import * as controller from "./auth.controller.js";
import {
  registerBody,
  loginBody,
  refreshTokenBody,
  updateMeBody,
  changePasswordBody,
  forgotPasswordBody,
  requestVerificationBody,
  resetPasswordBody,
  verifyEmailParams,
  aceptarPoliticaBody,
} from "./auth.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";
import { uploadLimiter } from "../../shared/middlewares/rateLimit.js";
import { recibirArchivos } from "../../shared/utils/uploads.js";

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
 *         foto_url: { type: string, nullable: true, description: Foto de perfil (800 px) }
 *         foto_miniatura_url: { type: string, nullable: true, description: Miniatura cuadrada de 200 px }
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
 *           description: >
 *             Vigencia REFRESH_EXPIRES_IN (30 días por defecto); la sesión vence con él. Se renueva con
 *             `POST /auth/refresh-token`, que devuelve uno nuevo: guardar siempre el último.
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
 *       Envía un correo con el enlace `${FRONTEND_URL}/verificar-email/<token>` (vigente 24 horas).
 *       El email sin verificar no impide iniciar sesión ni reservar citas.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [nombre, apellido, email, password, acepta_politica_datos]
 *             properties:
 *               acepta_politica_datos:
 *                 type: boolean
 *                 enum: [true]
 *                 description: >
 *                   Autorización del titular para el tratamiento de sus datos (Ley 1581 de 2012). Debe ser
 *                   `true`; se guarda con la fecha, la IP y la versión vigente de la política.
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
 *               canal:
 *                 type: string
 *                 enum: [app, panel_web]
 *                 default: app
 *                 description: >
 *                   Desde dónde se registra el titular (el panel web envía `panel_web`). Es el canal de su
 *                   autorización de datos. `panel` no se acepta: es el de un cliente que registró un negocio.
 *     responses:
 *       201:
 *         description: Cuenta creada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Cuenta creada. Te enviamos un correo para confirmar tu email }
 *                 data: { $ref: '#/components/schemas/Usuario' }
 *       409:
 *         description: >
 *           Ya existe una cuenta con ese correo (también si un negocio la creó desde el panel): el mensaje
 *           sugiere usar "Olvidé mi contraseña" para activarla.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example:
 *               success: false
 *               message: Ya existe una cuenta con ese correo. Si no recuerdas la contraseña o un negocio te registró, usa "Olvidé mi contraseña" para activarla
 *               errors: { email: Ya está registrado }
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

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Renovar la sesión
 *     description: >
 *       Cambia el refresh token por un access token y un refresh token nuevos, en la misma sesión,
 *       y extiende su vencimiento (REFRESH_EXPIRES_IN, 30 días por defecto, desde ahora). El refresh
 *       token enviado y el access token anterior dejan de servir: guardar los dos nuevos. No necesita
 *       `Authorization`. Si dos renovaciones llegan a la vez con el mismo token, solo una funciona.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [refresh_token]
 *             properties:
 *               refresh_token: { type: string }
 *     responses:
 *       200:
 *         description: Sesión renovada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Sesión renovada }
 *                 data: { $ref: '#/components/schemas/Sesion' }
 *       401:
 *         description: Refresh token inválido, vencido, ya usado o de una sesión cerrada (volver a iniciar sesión)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { success: false, message: Refresh token inválido o expirado }
 *       403:
 *         description: La cuenta está desactivada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post("/refresh-token", validate({ body: refreshTokenBody }), controller.refreshToken);

/**
 * @swagger
 * components:
 *   schemas:
 *     PerfilPropio:
 *       allOf:
 *         - $ref: '#/components/schemas/Usuario'
 *         - type: object
 *           properties:
 *             telefono_verificado: { type: boolean }
 *             idioma: { type: string, enum: [es, en] }
 *             zona_horaria: { type: string, example: America/Bogota }
 *             notif_email: { type: boolean }
 *             notif_push: { type: boolean }
 *             notif_whatsapp: { type: boolean }
 *             ultimo_acceso: { type: string, nullable: true, example: "2026-09-26 08:30:00" }
 *             fecha_registro: { type: string, example: "2026-09-01 10:00:00" }
 */

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Perfil del usuario autenticado
 *     description: >
 *       Perfil, preferencias y los negocios a los que puede entrar en el panel (igual que
 *       `GET /negocios/mios`: propios y donde es empleado activo, con `relacion` y `rol`).
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Perfil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/PerfilPropio'
 *                     - type: object
 *                       properties:
 *                         requiere_aceptar_politica:
 *                           type: boolean
 *                           description: >
 *                             No tiene una autorización de datos vigente para la versión actual de la política:
 *                             la app o el panel deben pedirla y enviarla a POST /auth/politica-datos/aceptar.
 *                         politica: { $ref: '#/components/schemas/PoliticaDatos' }
 *                         politica_aceptada:
 *                           type: object
 *                           nullable: true
 *                           description: >
 *                             Última autorización de datos no revocada del usuario. Puede ser de una versión
 *                             anterior a la vigente (entonces `requiere_aceptar_politica` es true). null si nunca aceptó.
 *                           properties:
 *                             version: { type: string, example: "1.0" }
 *                             fecha: { type: string, example: "2026-09-27 10:00:00" }
 *                             canal:
 *                               type: string
 *                               enum: [app, panel, panel_web, invitacion, aceptacion]
 *                               description: >
 *                                 Dónde se aceptó. `panel_web`: se registró en el panel web; `panel`: lo registró un negocio.
 *                         negocios: { type: array, items: { $ref: '#/components/schemas/NegocioMio' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   patch:
 *     summary: Editar el perfil propio
 *     description: >
 *       Al menos un campo. `telefono` se vacía con `null`; si cambia, deja de estar verificado.
 *       El email y la foto no se cambian aquí.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             minProperties: 1
 *             properties:
 *               nombre: { type: string, minLength: 2, maxLength: 80 }
 *               apellido: { type: string, minLength: 2, maxLength: 80 }
 *               telefono: { type: string, nullable: true, example: "3003334455" }
 *               idioma: { type: string, enum: [es, en] }
 *               zona_horaria: { type: string, description: Zona IANA, example: America/Bogota }
 *               notif_email: { type: boolean }
 *               notif_push: { type: boolean }
 *               notif_whatsapp: { type: boolean }
 *     responses:
 *       200:
 *         description: Perfil actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Perfil actualizado }
 *                 data: { $ref: '#/components/schemas/PerfilPropio' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
/**
 * @swagger
 * /auth/politica-datos/aceptar:
 *   post:
 *     summary: Aceptar la versión vigente de la política de datos
 *     description: >
 *       Para cuentas que ya existían o que no tienen una autorización para la versión actual
 *       (`GET /auth/me` devuelve `requiere_aceptar_politica: true`). Guarda la autorización (canal
 *       `aceptacion`, versión vigente, fecha e IP). Si ya la había aceptado no crea otra y responde 200 igual.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [acepta_politica_datos]
 *             properties:
 *               acepta_politica_datos: { type: boolean, enum: [true] }
 *     responses:
 *       200:
 *         description: Aceptada (o ya aceptada)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Política de datos aceptada }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id_autorizacion: { type: integer }
 *                     canal: { type: string, enum: [app, panel, panel_web, invitacion, aceptacion] }
 *                     version_politica: { type: string, example: "1.0" }
 *                     fecha_autorizacion: { type: string, example: "2026-09-27 10:00:00" }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  "/politica-datos/aceptar",
  authMiddleware,
  validate({ body: aceptarPoliticaBody }),
  controller.aceptarPolitica
);

router.get("/me", authMiddleware, controller.getMe);

/**
 * @swagger
 * /auth/me/foto:
 *   put:
 *     summary: Subir o reemplazar la foto de perfil
 *     description: >
 *       multipart/form-data con el archivo en `foto`. La foto anterior se borra. Responde el perfil
 *       con `foto_url` (800 px) y `foto_miniatura_url` (200 px). Máximo 30 subidas cada 15 minutos.
 *     tags: [Auth]
 *     requestBody: { $ref: '#/components/requestBodies/Foto' }
 *     responses:
 *       200:
 *         description: Foto actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Foto de perfil actualizada }
 *                 data: { $ref: '#/components/schemas/PerfilPropio' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ArchivoInvalido' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/AlmacenamientoNoDisponible' }
 *   delete:
 *     summary: Eliminar la foto de perfil
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Foto eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Foto de perfil eliminada }
 *                 data: { $ref: '#/components/schemas/PerfilPropio' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404:
 *         description: No tiene foto
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { success: false, message: No tienes foto de perfil }
 */
router.put("/me/foto", authMiddleware, uploadLimiter, recibirArchivos("usuario_foto"), controller.subirFoto);
router.delete("/me/foto", authMiddleware, controller.eliminarFoto);
router.patch("/me", authMiddleware, validate({ body: updateMeBody }), controller.updateMe);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Cambiar la contraseña
 *     description: >
 *       Exige la contraseña actual. Los fallos cuentan para el bloqueo de 5 intentos (403 al
 *       alcanzarlo). Cierra las demás sesiones del usuario; la de esta petición sigue activa.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [password_actual, password_nueva]
 *             properties:
 *               password_actual: { type: string }
 *               password_nueva:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 72
 *                 description: Al menos una letra y un número; distinta de la actual.
 *     responses:
 *       200:
 *         description: Contraseña actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Contraseña actualizada. Se cerraron las demás sesiones }
 *                 data: { nullable: true, example: null }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Cuenta bloqueada por intentos fallidos
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       422:
 *         description: Contraseña actual incorrecta, nueva contraseña inválida o igual a la actual
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { success: false, message: La contraseña actual no es correcta, errors: { password_actual: Contraseña incorrecta } }
 */
router.post(
  "/change-password",
  authMiddleware,
  validate({ body: changePasswordBody }),
  controller.changePassword
);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Pedir un enlace para restablecer la contraseña
 *     description: >
 *       Responde igual exista o no el email. Si la cuenta existe y está activa, envía
 *       `${FRONTEND_URL}/restablecer-password/<token>` (vigente 1 hora; cada enlace nuevo invalida el
 *       anterior; máximo uno por minuto). Funciona aunque la cuenta esté bloqueada por intentos fallidos.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Solicitud recibida
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Si el correo está registrado, te enviamos un enlace para restablecer la contraseña" }
 *                 data: { nullable: true, example: null }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 */
router.post("/forgot-password", validate({ body: forgotPasswordBody }), controller.forgotPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Restablecer la contraseña con el token del correo
 *     description: >
 *       Cambia la contraseña, desbloquea la cuenta (reinicia los intentos fallidos), marca el email
 *       como verificado y cierra todas las sesiones. No inicia sesión: después se llama a `/auth/login`.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [token, password]
 *             properties:
 *               token: { type: string, pattern: '^[0-9a-f]{64}$', description: El del enlace del correo }
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 72
 *                 description: Al menos una letra y un número.
 *     responses:
 *       200:
 *         description: Contraseña restablecida
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Contraseña restablecida. Ya puedes iniciar sesión }
 *                 data: { nullable: true, example: null }
 *       400:
 *         description: El token no existe, ya se usó o venció
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { success: false, message: El enlace para restablecer la contraseña no es válido o ya venció. Solicita uno nuevo }
 *       403:
 *         description: La cuenta está desactivada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 */
router.post("/reset-password", validate({ body: resetPasswordBody }), controller.resetPassword);

/**
 * @swagger
 * /auth/verify-email/{token}:
 *   get:
 *     summary: Verificar el email con el token del correo
 *     description: >
 *       La pantalla `${FRONTEND_URL}/verificar-email/<token>` del frontend llama a este endpoint.
 *       El token sirve una sola vez: un segundo intento da 400 (consultar `GET /auth/me` para saber
 *       si ya está verificado).
 *     tags: [Auth]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string, pattern: '^[0-9a-f]{64}$' }
 *     responses:
 *       200:
 *         description: Correo verificado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Correo verificado }
 *                 data: { nullable: true, example: null }
 *       400:
 *         description: El token no existe, ya se usó o venció
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { success: false, message: El enlace de verificación no es válido o ya venció }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 */
router.get("/verify-email/:token", validate({ params: verifyEmailParams }), controller.verifyEmail);

/**
 * @swagger
 * /auth/resend-verification:
 *   post:
 *     summary: Reenviar el correo de verificación
 *     description: Envía un enlace nuevo (vigente 24 horas) e invalida el anterior. Máximo uno por minuto.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Correo enviado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Te enviamos un nuevo enlace de verificación }
 *                 data:
 *                   type: object
 *                   properties:
 *                     email: { type: string, format: email }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       409:
 *         description: El correo ya está verificado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { success: false, message: Tu correo ya está verificado }
 *       429:
 *         description: Se envió otro correo hace menos de un minuto, o se superó el límite de solicitudes
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       503:
 *         description: No se pudo enviar el correo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post("/resend-verification", authMiddleware, controller.resendVerification);

/**
 * @swagger
 * /auth/request-verification:
 *   post:
 *     summary: Pedir un enlace de verificación sin sesión
 *     description: >
 *       Para cuando el enlace venció o se abrió en otro dispositivo sin sesión. Responde igual exista
 *       o no el email, y aunque ya esté verificado. Si la cuenta existe, está activa y no está
 *       verificada, envía `${FRONTEND_URL}/verificar-email/<token>` (vigente 24 horas; cada enlace
 *       nuevo invalida el anterior; máximo uno por minuto). Con sesión, usar `POST /auth/resend-verification`,
 *       que sí informa si ya está verificado o si el correo no se pudo enviar.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Solicitud recibida
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Si el correo está registrado y sin verificar, te enviamos un nuevo enlace de verificación" }
 *                 data: { nullable: true, example: null }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 */
router.post("/request-verification", validate({ body: requestVerificationBody }), controller.requestVerification);

export default router;
