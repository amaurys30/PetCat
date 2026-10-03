import express from "express";
import * as controller from "./autorizacion.controller.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     PoliticaDatos:
 *       type: object
 *       description: Versión vigente de la política de tratamiento de datos y enlace a su texto completo.
 *       properties:
 *         version: { type: string, example: "1.0" }
 *         url:
 *           type: string
 *           nullable: true
 *           description: null si PetCat todavía no publicó el enlace (configuracion_global.politica_datos_url).
 *           example: https://petcat.co/politica-de-datos
 */

/**
 * @swagger
 * /politica-datos:
 *   get:
 *     summary: Política de datos vigente
 *     description: >
 *       Público (sin token). Para enlazar la política en el registro y al aceptar una invitación,
 *       antes de que haya sesión. Con sesión, `GET /auth/me` trae lo mismo en `politica`.
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: Política vigente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { $ref: '#/components/schemas/PoliticaDatos' }
 */
router.get("/politica-datos", controller.getPoliticaVigente);

export default router;
