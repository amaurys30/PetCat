import express from "express";
import { createSucursal, getSucursalesPublico, updateSucursal } from "./sucursal.controller.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Sucursales
 *   description: Gestión de sucursales
 */

/**
 * @swagger
 * /sucursales/register/{id_negocio}:
 *   post:
 *     summary: Crear una sucursal para un negocio (solo propietario)
 *     tags: [Sucursales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_negocio
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
 *             required:
 *               - nombre
 *               - direccion
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: Sucursal Centro
 *               descripcion:
 *                 type: string
 *               telefono:
 *                 type: string
 *               direccion:
 *                 type: string
 *               ciudad:
 *                 type: string
 *               latitud:
 *                 type: number
 *               longitud:
 *                 type: number
 *               es_principal:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Sucursal creada correctamente
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Negocio no encontrado
 */
router.post(
  "/register/:id_negocio",
  authMiddleware,
  createSucursal
);

/**
 * @swagger
 * /sucursales/negocios/{id_negocio}/sucursales:
 *   get:
 *     summary: Obtener sucursales públicas de un negocio
 *     tags: [Sucursales]
 *     parameters:
 *       - in: path
 *         name: id_negocio
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del negocio
 *     responses:
 *       200:
 *         description: Lista de sucursales
 *       404:
 *         description: Negocio no encontrado
 */
router.get("/negocios/:id_negocio/sucursales", getSucursalesPublico);

// sucursal.routes.js

/**
 * @swagger
 * /sucursales/{id_sucursal}:
 *   patch:
 *     summary: Editar una sucursal (propietario o admin)
 *     tags: [Sucursales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_sucursal
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               telefono:
 *                 type: string
 *               direccion:
 *                 type: string
 *               ciudad:
 *                 type: string
 *               latitud:
 *                 type: number
 *               longitud:
 *                 type: number
 *               es_principal:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Sucursal actualizada
 *       403:
 *         description: No autorizado
 *       404:
 *         description: No encontrada
 */
router.patch("/:id_sucursal", authMiddleware, updateSucursal);

export default router;