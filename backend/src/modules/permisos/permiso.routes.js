import express from "express";
import * as controller from "./permiso.controller.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * /permisos:
 *   get:
 *     summary: Catálogo de permisos
 *     description: >
 *       Módulos y acciones que puede llevar `permisos_json` de un rol, en el mismo formato
 *       `{ modulo: [acciones] }`. Lo usa el editor de roles del panel. Sucursales, horarios,
 *       disponibilidad y datos del negocio se controlan con `configuracion`.
 *     tags: [Roles]
 *     responses:
 *       200:
 *         description: Catálogo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data:
 *                   type: object
 *                   additionalProperties: { type: array, items: { type: string } }
 *                   example:
 *                     citas: [ver, ver_todas, crear, editar, cancelar]
 *                     configuracion: [ver, editar]
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/permisos", authMiddleware, controller.getCatalogo);

export default router;
