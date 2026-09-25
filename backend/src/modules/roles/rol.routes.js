// ================================
// modules/roles/rol.routes.js
// ================================

import express from "express";
import { createRol, getRolesByNegocio } from "./rol.controller.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { authorize } from "../../shared/middlewares/authorize.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: Gestión de roles personalizados del negocio
 */


/**
 * @swagger
 * /roles/register/{id_negocio}:
 *   post:
 *     summary: Crear rol personalizado para un negocio (Propietario o admin)
 *     description: |
 *       Permite crear un nuevo rol personalizado dentro de un negocio.
 *       
 *       Solo puede hacerlo:
 *       - El propietario del negocio
 *       - Un empleado con permiso roles.crear
 *       
 *       No se permite:
 *       - Crear roles duplicados dentro del mismo negocio
 *       - Modificar roles globales del sistema desde aquí
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_negocio
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del negocio donde se creará el rol
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - permisos_json
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: Auxiliar Veterinario
 *                 description: Nombre único del rol dentro del negocio
 *               descripcion:
 *                 type: string
 *                 example: Puede apoyar en atención básica y gestión de citas
 *                 description: Descripción opcional del rol
 *               permisos_json:
 *                 type: object
 *                 example:
 *                   citas:
 *                     - ver
 *                     - crear
 *                     - editar
 *                   clientes:
 *                     - ver
 *                   mascotas:
 *                     - ver
 *                     - crear
 *                 description: Permisos granulares por módulo
 *     responses:
 *       201:
 *         description: Rol creado correctamente
 *       400:
 *         description: Datos inválidos o rol duplicado
 *       403:
 *         description: No autorizado para crear roles
 *       404:
 *         description: Negocio no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.post(
  "/register/:id_negocio",
  authMiddleware,
  authorize("roles", "crear"),
  createRol
);


/**
 * @swagger
 * /roles/negocio/{id_negocio}:
 *   get:
 *     summary: Obtener todos los roles disponibles de un negocio (Propietario o admin)
 *     description: |
 *       Retorna:
 *       - Roles globales del sistema
 *       - Roles personalizados creados por ese negocio
 *
 *       Solo propietario o empleados con permiso roles.ver
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_negocio
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del negocio
 *     responses:
 *       200:
 *         description: Lista de roles obtenida correctamente
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Negocio no encontrado
 *       500:
 *         description: Error interno
 */
router.get(
  "/negocio/:id_negocio",
  authMiddleware,
  authorize("roles", "ver"),
  getRolesByNegocio
);

export default router;