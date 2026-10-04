import express from "express";
import * as controller from "./horario.controller.js";
import { putHorariosBody } from "./horario.schemas.js";
import { idSucursalParams } from "../sucursales/sucursal.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { authorize } from "../../shared/middlewares/authorize.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Horario:
 *       type: object
 *       properties:
 *         id_horario: { type: integer, example: 7 }
 *         dia_semana: { type: integer, minimum: 0, maximum: 6, description: "0 = domingo ... 6 = sábado" }
 *         hora_apertura: { type: string, example: "08:00" }
 *         hora_cierre: { type: string, example: "12:00" }
 *
 * /sucursales/{id_sucursal}/horarios:
 *   get:
 *     summary: Horario de atención de una sucursal
 *     description: >
 *       Público (sin token). Rangos ordenados por día y hora; un día puede tener varios rangos
 *       (horario partido) y un día sin rangos está cerrado. 404 si la sucursal o su negocio
 *       están inactivos.
 *     tags: [Horarios]
 *     security: []
 *     parameters:
 *       - { in: path, name: id_sucursal, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Rangos de la semana
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Horario' } }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   put:
 *     summary: Reemplazar el horario de la semana
 *     description: >
 *       Requiere `configuracion.editar`. Reemplaza todos los rangos de la sucursal en una sola
 *       transacción. Se permiten varios rangos por día siempre que no se crucen (pueden tocarse:
 *       08:00–12:00 y 12:00–14:00). Una lista vacía deja la sucursal cerrada toda la semana.
 *       Horas en formato HH:MM (también se acepta HH:MM:SS).
 *     tags: [Horarios]
 *     parameters:
 *       - { in: path, name: id_sucursal, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [horarios]
 *             properties:
 *               horarios:
 *                 type: array
 *                 maxItems: 42
 *                 items:
 *                   type: object
 *                   additionalProperties: false
 *                   required: [dia_semana, hora_apertura, hora_cierre]
 *                   properties:
 *                     dia_semana: { type: integer, minimum: 0, maximum: 6 }
 *                     hora_apertura: { type: string, example: "08:00" }
 *                     hora_cierre: { type: string, example: "12:00" }
 *           example:
 *             horarios:
 *               - { dia_semana: 1, hora_apertura: "08:00", hora_cierre: "12:00" }
 *               - { dia_semana: 1, hora_apertura: "14:00", hora_cierre: "18:00" }
 *               - { dia_semana: 6, hora_apertura: "08:00", hora_cierre: "12:00" }
 *     responses:
 *       200:
 *         description: >
 *           Horario guardado: la semana completa y `citas_afectadas`, las citas futuras pendientes o
 *           confirmadas de esta sucursal (de cualquier profesional) que con el nuevo horario ya no caben:
 *           en la disponibilidad de su profesional recortada por este horario o, si no tienen profesional,
 *           en el horario. El cambio se guarda igual y la lista no se puede volver a consultar después.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Horarios actualizados }
 *                 data:
 *                   type: object
 *                   properties:
 *                     horarios: { type: array, items: { $ref: '#/components/schemas/Horario' } }
 *                     citas_afectadas: { $ref: '#/components/schemas/CitasAfectadas' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422:
 *         description: Datos inválidos o rangos que se cruzan (el error indica el índice del rango)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example:
 *               success: false
 *               message: Hay rangos de horario que se cruzan
 *               errors: { "horarios.1": "Se cruza con el rango de 08:00 a 12:00 del lunes" }
 */
router.get("/sucursales/:id_sucursal/horarios", validate({ params: idSucursalParams }), controller.getHorarios);

router.put(
  "/sucursales/:id_sucursal/horarios",
  authMiddleware,
  validate({ params: idSucursalParams, body: putHorariosBody }),
  authorize("configuracion", "editar"),
  controller.replaceHorarios
);

export default router;
