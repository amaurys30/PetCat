import express from "express";
import * as controller from "./sucursal.controller.js";
import { createSucursalBody, idSucursalParams, updateSucursalBody } from "./sucursal.schemas.js";
import { idNegocioParams } from "../negocios/negocio.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { authorize } from "../../shared/middlewares/authorize.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

const editar = authorize("configuracion", "editar");

/**
 * @swagger
 * components:
 *   schemas:
 *     SucursalInput:
 *       type: object
 *       additionalProperties: false
 *       description: Campos opcionales con `null` se vacían. `latitud` y `longitud` van juntas.
 *       properties:
 *         nombre: { type: string, minLength: 2, maxLength: 150, example: Sede Norte }
 *         direccion: { type: string, maxLength: 300, example: "Carrera 25 # 30-10" }
 *         ciudad: { type: string, maxLength: 100, example: Sincelejo, description: Por defecto Sincelejo }
 *         descripcion: { type: string, maxLength: 300, nullable: true }
 *         telefono: { type: string, nullable: true, example: "6052802020" }
 *         latitud: { type: number, minimum: -90, maximum: 90, nullable: true }
 *         longitud: { type: number, minimum: -180, maximum: 180, nullable: true }
 *         es_principal:
 *           type: boolean
 *           description: >
 *             Marcarla como principal desmarca la anterior. No se puede desmarcar la principal
 *             (409): se marca otra. La primera sucursal del negocio siempre queda como principal.
 *     Sucursal:
 *       type: object
 *       properties:
 *         id_sucursal: { type: integer, example: 3 }
 *         id_negocio: { type: integer, example: 1 }
 *         nombre: { type: string }
 *         descripcion: { type: string, nullable: true }
 *         telefono: { type: string, nullable: true }
 *         direccion: { type: string }
 *         ciudad: { type: string }
 *         latitud: { type: number, nullable: true }
 *         longitud: { type: number, nullable: true }
 *         es_principal: { type: boolean }
 */

/**
 * @swagger
 * /negocios/{id_negocio}/sucursales:
 *   get:
 *     summary: Sucursales activas de un negocio
 *     description: Público (sin token). La principal primero. 404 si el negocio no existe o está inactivo.
 *     tags: [Sucursales]
 *     security: []
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
 *                 data: { type: array, items: { $ref: '#/components/schemas/Sucursal' } }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   post:
 *     summary: Crear una sucursal
 *     description: Requiere `configuracion.editar`. La primera sucursal activa del negocio queda como principal.
 *     tags: [Sucursales]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/SucursalInput'
 *               - required: [nombre, direccion]
 *     responses:
 *       201:
 *         description: Sucursal creada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Sucursal creada }
 *                 data: { $ref: '#/components/schemas/Sucursal' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/negocios/:id_negocio/sucursales",
  validate({ params: idNegocioParams }),
  controller.getSucursalesPublicas
);

router.post(
  "/negocios/:id_negocio/sucursales",
  authMiddleware,
  validate({ params: idNegocioParams, body: createSucursalBody }),
  editar,
  controller.createSucursal
);

/**
 * @swagger
 * /sucursales/{id_sucursal}:
 *   get:
 *     summary: Detalle público de una sucursal
 *     description: Sin token. 404 si la sucursal o su negocio están inactivos.
 *     tags: [Sucursales]
 *     security: []
 *     parameters:
 *       - { in: path, name: id_sucursal, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Sucursal
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { $ref: '#/components/schemas/Sucursal' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   patch:
 *     summary: Actualizar una sucursal
 *     description: >
 *       Requiere `configuracion.editar`. Al menos un campo. Marcar `es_principal: true` desmarca
 *       la anterior; enviar `es_principal: false` sobre la principal da 409.
 *     tags: [Sucursales]
 *     parameters:
 *       - { in: path, name: id_sucursal, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SucursalInput' }
 *     responses:
 *       200:
 *         description: Sucursal actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Sucursal actualizada }
 *                 data: { $ref: '#/components/schemas/Sucursal' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Se intentó desmarcar la sucursal principal
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   delete:
 *     summary: Eliminar una sucursal (borrado lógico)
 *     description: >
 *       Requiere `configuracion.editar`. 409 si tiene citas futuras pendientes o confirmadas, o si
 *       es la principal y hay otras sucursales activas (marcar otra primero). La única sucursal
 *       del negocio sí se puede eliminar.
 *     tags: [Sucursales]
 *     parameters:
 *       - { in: path, name: id_sucursal, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Sucursal eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Sucursal eliminada }
 *                 data: { nullable: true, example: null }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Tiene citas futuras activas o es la principal con otras sucursales activas
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { success: false, message: "Es la sucursal principal: marca otra como principal antes de eliminarla" }
 */
router.get("/sucursales/:id_sucursal", validate({ params: idSucursalParams }), controller.getSucursalPublica);

router.patch(
  "/sucursales/:id_sucursal",
  authMiddleware,
  validate({ params: idSucursalParams, body: updateSucursalBody }),
  editar,
  controller.updateSucursal
);

router.delete(
  "/sucursales/:id_sucursal",
  authMiddleware,
  validate({ params: idSucursalParams }),
  editar,
  controller.deleteSucursal
);

export default router;
