import express from "express";
import * as controller from "./empleado.controller.js";
import {
  createEmpleadoBody,
  idEmpleadoParams,
  listEmpleadosQuery,
  updateEmpleadoBody,
} from "./empleado.schemas.js";
import { idNegocioParams } from "../negocios/negocio.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { authorize } from "../../shared/middlewares/authorize.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     EmpleadoInput:
 *       type: object
 *       additionalProperties: false
 *       description: >
 *         `id_usuario`, `id_negocio`, `activo` y `fecha_retiro` no se aceptan (422): la cuenta se
 *         vincula con una invitación y el estado se cambia con desactivar/reactivar. Los campos
 *         opcionales se vacían con `null`.
 *       properties:
 *         id_rol: { type: integer, description: Rol del sistema o propio del negocio, example: 2 }
 *         nombre: { type: string, minLength: 2, maxLength: 80, example: Carlos }
 *         apellido: { type: string, minLength: 2, maxLength: 80, example: Pérez }
 *         email: { type: string, format: email, nullable: true, description: Único en el negocio }
 *         telefono: { type: string, nullable: true, example: "3002223344" }
 *         documento: { type: string, maxLength: 30, nullable: true }
 *         especialidad: { type: string, maxLength: 150, nullable: true }
 *         titulo_profesional: { type: string, maxLength: 150, nullable: true }
 *         registro_profesional: { type: string, maxLength: 60, nullable: true }
 *         foto_url: { type: string, format: uri, nullable: true }
 *         notas: { type: string, maxLength: 2000, nullable: true }
 *         fecha_vinculacion: { type: string, format: date, example: "2026-09-01", description: Por defecto, hoy }
 *     Empleado:
 *       type: object
 *       properties:
 *         id_empleado: { type: integer, example: 5 }
 *         id_negocio: { type: integer }
 *         id_usuario: { type: integer, nullable: true, description: Cuenta vinculada (null si aún no aceptó la invitación) }
 *         nombre: { type: string }
 *         apellido: { type: string }
 *         email: { type: string, nullable: true }
 *         telefono: { type: string, nullable: true }
 *         documento: { type: string, nullable: true }
 *         especialidad: { type: string, nullable: true }
 *         titulo_profesional: { type: string, nullable: true }
 *         registro_profesional: { type: string, nullable: true }
 *         foto_url: { type: string, nullable: true }
 *         notas: { type: string, nullable: true }
 *         activo: { type: boolean }
 *         fecha_vinculacion: { type: string, example: "2026-09-01" }
 *         fecha_retiro: { type: string, nullable: true }
 *         fecha_creacion: { type: string }
 *         fecha_actualizacion: { type: string }
 *         tiene_cuenta: { type: boolean }
 *         invitacion_pendiente: { type: boolean, description: Tiene una invitación sin usar y vigente }
 *         rol:
 *           type: object
 *           properties:
 *             id_rol: { type: integer }
 *             nombre: { type: string, example: Veterinario }
 *             permisos_json: { $ref: '#/components/schemas/Permisos' }
 *   responses:
 *     EmpleadoConflict:
 *       description: >
 *         Email en uso en el negocio. Si lo tiene un empleado inactivo, el mensaje lo indica con su
 *         id para reactivarlo.
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ErrorResponse' }
 *           example:
 *             success: false
 *             message: "Ese email pertenece a un empleado inactivo del negocio (id_empleado 12): puedes reactivarlo en lugar de crear otro"
 *             errors: { email: "Pertenece a un empleado inactivo que se puede reactivar: PATCH /empleados/12/reactivar" }
 */

/**
 * @swagger
 * /negocios/{id_negocio}/empleados:
 *   get:
 *     summary: Empleados del negocio (paginado)
 *     description: Requiere `empleados.ver`. Activos primero, luego por apellido y nombre. El rol no incluye permisos.
 *     tags: [Empleados]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *       - { $ref: '#/components/parameters/page' }
 *       - { $ref: '#/components/parameters/limit' }
 *       - { in: query, name: activo, schema: { type: string, enum: ["true", "false"] }, description: Sin filtro devuelve todos }
 *       - { in: query, name: q, schema: { type: string, maxLength: 100 }, description: Busca en nombre, apellido, email y documento }
 *     responses:
 *       200:
 *         description: Página de empleados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Empleado' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   post:
 *     summary: Crear un empleado
 *     description: >
 *       Requiere `empleados.crear`. El rol debe ser del sistema o del negocio (422 si no). Un
 *       empleado que crea a otro no puede asignarle un rol con permisos que el suyo no tiene (403).
 *       El empleado queda sin cuenta hasta que acepte una invitación.
 *     tags: [Empleados]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/EmpleadoInput'
 *               - required: [id_rol, nombre, apellido]
 *     responses:
 *       201:
 *         description: Empleado creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Empleado creado }
 *                 data: { $ref: '#/components/schemas/Empleado' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/EmpleadoConflict' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/negocios/:id_negocio/empleados",
  authMiddleware,
  validate({ params: idNegocioParams, query: listEmpleadosQuery }),
  authorize("empleados", "ver"),
  controller.getEmpleados
);

router.post(
  "/negocios/:id_negocio/empleados",
  authMiddleware,
  validate({ params: idNegocioParams, body: createEmpleadoBody }),
  authorize("empleados", "crear"),
  controller.createEmpleado
);

/**
 * @swagger
 * /empleados/{id_empleado}:
 *   get:
 *     summary: Detalle de un empleado
 *     description: Requiere `empleados.ver`. Incluye los permisos de su rol.
 *     tags: [Empleados]
 *     parameters:
 *       - { in: path, name: id_empleado, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Empleado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { $ref: '#/components/schemas/Empleado' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   patch:
 *     summary: Actualizar un empleado
 *     description: >
 *       Requiere `empleados.editar`. Al menos un campo. Cambiar el email invalida sus invitaciones
 *       pendientes. Un empleado no puede cambiar su propio rol, ni asignar un rol con permisos que
 *       el suyo no tiene, ni editar a un empleado con permisos que él no tiene (403). El propietario
 *       y el admin de plataforma no tienen esas restricciones.
 *     tags: [Empleados]
 *     parameters:
 *       - { in: path, name: id_empleado, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/EmpleadoInput' }
 *     responses:
 *       200:
 *         description: Empleado actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Empleado actualizado }
 *                 data: { $ref: '#/components/schemas/Empleado' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/EmpleadoConflict' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   delete:
 *     summary: Desactivar un empleado (borrado lógico)
 *     description: >
 *       Requiere `empleados.eliminar`. Marca `activo = false` y `fecha_retiro` = hoy, e invalida sus
 *       invitaciones pendientes; pierde el acceso al panel del negocio. 409 si ya está inactivo.
 *       Un empleado no puede desactivarse a sí mismo ni desactivar a uno con permisos que él no
 *       tiene (403).
 *     tags: [Empleados]
 *     parameters:
 *       - { in: path, name: id_empleado, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Empleado desactivado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Empleado desactivado }
 *                 data: { $ref: '#/components/schemas/Empleado' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: El empleado ya está inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get(
  "/empleados/:id_empleado",
  authMiddleware,
  validate({ params: idEmpleadoParams }),
  authorize("empleados", "ver"),
  controller.getEmpleado
);

router.patch(
  "/empleados/:id_empleado",
  authMiddleware,
  validate({ params: idEmpleadoParams, body: updateEmpleadoBody }),
  authorize("empleados", "editar"),
  controller.updateEmpleado
);

router.delete(
  "/empleados/:id_empleado",
  authMiddleware,
  validate({ params: idEmpleadoParams }),
  authorize("empleados", "eliminar"),
  controller.desactivarEmpleado
);

/**
 * @swagger
 * /empleados/{id_empleado}/reactivar:
 *   patch:
 *     summary: Reactivar un empleado
 *     description: >
 *       Requiere `empleados.editar`. 409 si ya está activo. Un empleado no puede reactivar a uno
 *       con permisos que él no tiene (403).
 *     tags: [Empleados]
 *     parameters:
 *       - { in: path, name: id_empleado, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Empleado reactivado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Empleado reactivado }
 *                 data: { $ref: '#/components/schemas/Empleado' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: El empleado ya está activo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.patch(
  "/empleados/:id_empleado/reactivar",
  authMiddleware,
  validate({ params: idEmpleadoParams }),
  authorize("empleados", "editar"),
  controller.reactivarEmpleado
);

export default router;
