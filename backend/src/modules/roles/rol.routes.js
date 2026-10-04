import express from "express";
import * as controller from "./rol.controller.js";
import { createRolBody, idRolParams, updateRolBody } from "./rol.schemas.js";
import { idNegocioParams } from "../negocios/negocio.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { authorize, authorizeAny } from "../../shared/middlewares/authorize.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Permisos:
 *       type: object
 *       description: "`{ modulo: [acciones] }`. Solo módulos y acciones del catálogo (GET /permisos)."
 *       additionalProperties: { type: array, items: { type: string } }
 *       example: { citas: [ver, crear, editar], clientes: [ver] }
 *     Rol:
 *       type: object
 *       properties:
 *         id_rol: { type: integer, example: 8 }
 *         id_negocio: { type: integer, nullable: true, description: null en los roles del sistema }
 *         nombre: { type: string, example: Auxiliar de peluquería }
 *         descripcion: { type: string, nullable: true }
 *         permisos_json: { $ref: '#/components/schemas/Permisos' }
 *         es_sistema: { type: boolean }
 *         fecha_creacion: { type: string }
 *     RolInput:
 *       type: object
 *       additionalProperties: false
 *       properties:
 *         nombre:
 *           type: string
 *           minLength: 2
 *           maxLength: 60
 *           description: Único en el negocio y distinto de los roles del sistema (sin distinguir mayúsculas)
 *         descripcion: { type: string, maxLength: 200, nullable: true }
 *         permisos_json: { $ref: '#/components/schemas/Permisos' }
 */

/**
 * @swagger
 * /negocios/{id_negocio}/roles:
 *   get:
 *     summary: Roles disponibles en el negocio
 *     description: >
 *       Requiere `roles.ver`, `empleados.crear` o `empleados.editar` (quien crea o edita empleados
 *       necesita elegir el rol). Los del sistema primero y luego los propios, con cuántos empleados
 *       activos e inactivos del negocio tienen cada uno.
 *     tags: [Roles]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Lista
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Rol'
 *                       - type: object
 *                         properties:
 *                           empleados_activos: { type: integer }
 *                           empleados_inactivos: { type: integer, description: También impiden eliminar el rol }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   post:
 *     summary: Crear un rol propio del negocio
 *     description: >
 *       Requiere `roles.crear`. Un empleado solo puede otorgar permisos que su propio rol tiene (403).
 *       El propietario y el admin de plataforma no tienen ese límite.
 *     tags: [Roles]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/RolInput'
 *               - required: [nombre, permisos_json]
 *     responses:
 *       201:
 *         description: Rol creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Rol creado }
 *                 data: { $ref: '#/components/schemas/Rol' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Nombre repetido en el negocio o igual al de un rol del sistema
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/negocios/:id_negocio/roles",
  authMiddleware,
  validate({ params: idNegocioParams }),
  authorizeAny([
    ["roles", "ver"],
    ["empleados", "crear"],
    ["empleados", "editar"],
  ]),
  controller.getRoles
);

router.post(
  "/negocios/:id_negocio/roles",
  authMiddleware,
  validate({ params: idNegocioParams, body: createRolBody }),
  authorize("roles", "crear"),
  controller.createRol
);

/**
 * @swagger
 * /roles/{id_rol}:
 *   patch:
 *     summary: Actualizar un rol propio
 *     description: >
 *       Requiere `roles.editar`. Los roles del sistema no se editan (403). Un empleado no puede
 *       editar su propio rol, ni un rol con permisos que él no tiene, ni otorgar permisos que
 *       él no tiene (403). Al menos un campo.
 *     tags: [Roles]
 *     parameters:
 *       - { in: path, name: id_rol, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RolInput' }
 *     responses:
 *       200:
 *         description: Rol actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Rol actualizado }
 *                 data: { $ref: '#/components/schemas/Rol' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Nombre repetido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   delete:
 *     summary: Eliminar un rol propio
 *     description: >
 *       Requiere `roles.eliminar`. Los roles del sistema no se eliminan (403); tampoco un rol con
 *       empleados asignados, activos o inactivos (409: el mensaje dice cuántos de cada uno y, si hay
 *       inactivos, que también hay que cambiarles el rol). Mismas reglas de escalada que al editar.
 *     tags: [Roles]
 *     parameters:
 *       - { in: path, name: id_rol, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Rol eliminado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Rol eliminado }
 *                 data: { nullable: true, example: null }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Hay empleados con este rol (activos o inactivos)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { success: false, message: "Hay 1 empleado activo y 2 empleados inactivos con este rol: cámbiales el rol antes de eliminarlo, también a los inactivos" }
 */
router.patch(
  "/roles/:id_rol",
  authMiddleware,
  validate({ params: idRolParams, body: updateRolBody }),
  authorize("roles", "editar"),
  controller.updateRol
);

router.delete(
  "/roles/:id_rol",
  authMiddleware,
  validate({ params: idRolParams }),
  authorize("roles", "eliminar"),
  controller.deleteRol
);

export default router;
