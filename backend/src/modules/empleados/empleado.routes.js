// negocio.routes.js
import express from "express";
import { createEmpleado, getEmpleadosByNegocio, updateEmpleado, getEmpleadoById, deleteEmpleado, reactivarEmpleado } from "./empleado.controller.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { authorize } from "../../shared/middlewares/authorize.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Empleados
 *   description: Gestión de empleados
 */


/**
 * @swagger
 * /empleados/register/{id_negocio}:
 *   post:
 *     summary: Crear empleado (propietario o admin)
 *     tags: [Empleados]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_negocio
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id_rol
 *               - nombre
 *               - apellido
 *               - fecha_vinculacion
 *             properties:
 *               id_rol:
 *                 type: integer
 *               nombre:
 *                 type: string
 *               apellido:
 *                 type: string
 *               email:
 *                 type: string
 *               telefono:
 *                 type: string
 *               documento:
 *                 type: string
 *               especialidad:
 *                 type: string
 *               titulo_profesional:
 *                 type: string
 *               registro_profesional:
 *                 type: string
 *               fecha_vinculacion:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Empleado creado correctamente
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Negocio no encontrado
 *       500:
 *         description: Error interno del servidor
 * 
 */
router.post(
  "/register/:id_negocio",
  authMiddleware,
  authorize("empleados", "crear"),
  createEmpleado
);

/**
 * @swagger
 * /empleados/negocio/{id_negocio}:
 *   get:
 *     summary: Obtener empleados de un negocio (Propietario o admin)
 *     tags: [Empleados]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_negocio
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de empleados
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Negocio no encontrado
 */
router.get(
  "/negocio/:id_negocio",
  authMiddleware,
  authorize("empleados", "ver"),
  getEmpleadosByNegocio
);

/**
 * @swagger
 * /empleados/{id_empleado}:
 *   patch:
 *     summary: Editar empleado (Propietario o admin)
 *     tags: [Empleados]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_empleado
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del empleado
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_rol:
 *                 type: integer
 *                 example: 2
 *               id_usuario:
 *                 type: integer
 *                 example: 10
 *               nombre:
 *                 type: string
 *               apellido:
 *                 type: string
 *               email:
 *                 type: string
 *               telefono:
 *                 type: string
 *               documento:
 *                 type: string
 *               especialidad:
 *                 type: string
 *               titulo_profesional:
 *                 type: string
 *               registro_profesional:
 *                 type: string
 *               activo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Empleado actualizado correctamente
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Empleado no encontrado
 *       500:
 *         description: Error interno
 */
router.patch(
  "/:id_empleado",
  authMiddleware,
  authorize("empleados", "editar"),
  updateEmpleado
);

/**
 * @swagger
 * /empleados/{id_empleado}:
 *   get:
 *     summary: Obtener perfil de un empleado (Propietario o admin)
 *     tags: [Empleados]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_empleado
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Perfil del empleado
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Empleado no encontrado
 */
router.get(
  "/:id_empleado",
  authMiddleware,
  authorize("empleados", "ver"),
  getEmpleadoById
);

/**
 * @swagger
 * /empleados/{id_empleado}:
 *   delete:
 *     summary: Desactivar empleado (Propietario o admin)
 *     description: Solo propietario o administrador con permisos puede desactivar empleados
 *     tags: [Empleados]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_empleado
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del empleado
 *     responses:
 *       200:
 *         description: Empleado desactivado correctamente
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Empleado no encontrado
 *       400:
 *         description: Operación inválida
 */
router.delete(
  "/:id_empleado",
  authMiddleware,
  authorize("empleados", "eliminar"),
  deleteEmpleado
);

/**
 * @swagger
 * /empleados/{id_empleado}/reactivar:
 *   patch:
 *     summary: Reactivar empleado (Propietario o admin)
 *     description: Solo propietario o administrador con permisos puede reactivar empleados
 *     tags: [Empleados]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_empleado
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del empleado
 *     responses:
 *       200:
 *         description: Empleado reactivado correctamente
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Empleado no encontrado
 *       400:
 *         description: Operación inválida
 */
router.patch(
  "/:id_empleado/reactivar",
  authMiddleware,
  authorize("empleados", "editar"),
  reactivarEmpleado
);

export default router;
