// negocio.routes.js
import express from "express";
import { createNegocio, getMisNegocios, getNegocioPublico, updateNegocio } from "./negocio.controller.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Negocios
 *   description: Gestión de negocios
 */

/**
 * @swagger
 * /negocios/register:
 *   post:
 *     summary: Crear un negocio
 *     tags: [Negocios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - tipo
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: Veterinaria Patitas
 *               tipo:
 *                 type: string
 *                 example: veterinaria
 *               descripcion:
 *                 type: string
 *               telefono:
 *                 type: string
 *               email:
 *                 type: string
 *               direccion:
 *                 type: string
 *               ciudad:
 *                 type: string
 *     responses:
 *       201:
 *         description: Negocio creado correctamente
 *       403:
 *         description: No autorizado
 *       401:
 *         description: Token inválido o requerido
 */
router.post("/register", authMiddleware, createNegocio);

/**
 * @swagger
 * /negocios/mis-negocios:
 *   get:
 *     summary: Obtener negocios del usuario autenticado
 *     tags: [Negocios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de negocios
 *       403:
 *         description: No autorizado
 */
router.get("/mis-negocios", authMiddleware, getMisNegocios);

/**
 * @swagger
 * /negocios/{id}:
 *   get:
 *     summary: Perfil público completo de un negocio
 *     tags: [Negocios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del negocio
 *     responses:
 *       200:
 *         description: Perfil del negocio
 *       404:
 *         description: Negocio no encontrado
 */
router.get("/:id", getNegocioPublico);


//endpoint de actualizar 
/**
 * @swagger
 * /negocios/{id}:
 *   put:
 *     summary: Actualizar información de un negocio (solo propietario)
 *     tags: [Negocios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del negocio
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               tipo:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               telefono:
 *                 type: string
 *               whatsapp:
 *                 type: string
 *               email:
 *                 type: string
 *               sitio_web:
 *                 type: string
 *               direccion:
 *                 type: string
 *               ciudad:
 *                 type: string
 *               departamento:
 *                 type: string
 *               pais:
 *                 type: string
 *               codigo_postal:
 *                 type: string
 *               latitud:
 *                 type: number
 *               longitud:
 *                 type: number
 *               logo_url:
 *                 type: string
 *               banner_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Negocio actualizado correctamente
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Negocio no encontrado
 */
router.put("/:id", authMiddleware, updateNegocio);


export default router;