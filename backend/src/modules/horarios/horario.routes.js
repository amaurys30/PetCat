// ===============================
// src/modules/horarios/horario.routes.js
// ===============================

import express from "express";
import { createHorario } from "./horario.controller.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { authorize } from "../../shared/middlewares/authorize.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Horarios
 *   description: Gestión de horarios de atención de sucursales
 */

/**
 * @swagger
 * /horarios/sucursales/{id_sucursal}/horarios:
 *   post:
 *     summary: Crear horario de atención para una sucursal (Propietario o admin)
 *     description: |
 *       Permite registrar un horario de atención para una sucursal.
 *
 *       Reglas:
 *       - Solo propietario del negocio o empleados autorizados
 *       - Una sucursal solo puede tener un horario por día
 *       - hora_apertura debe ser menor que hora_cierre
 *       - dia_semana debe estar entre 0 y 6
 *
 *     tags: [Horarios]
 *
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id_sucursal
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la sucursal
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dia_semana
 *               - hora_apertura
 *               - hora_cierre
 *             properties:
 *               dia_semana:
 *                 type: integer
 *                 description: |
 *                   Día de la semana:
 *                   0 = Domingo
 *                   1 = Lunes
 *                   2 = Martes
 *                   3 = Miércoles
 *                   4 = Jueves
 *                   5 = Viernes
 *                   6 = Sábado
 *                 example: 1
 *
 *               hora_apertura:
 *                 type: string
 *                 format: time
 *                 description: Hora de apertura en formato HH:mm:ss
 *                 example: "08:00:00"
 *
 *               hora_cierre:
 *                 type: string
 *                 format: time
 *                 description: Hora de cierre en formato HH:mm:ss
 *                 example: "18:00:00"
 *
 *     responses:
 *       201:
 *         description: Horario creado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Horario creado correctamente
 *                 data:
 *                   type: object
 *                   properties:
 *                     id_horario:
 *                       type: integer
 *                       example: 10
 *                     id_sucursal:
 *                       type: integer
 *                       example: 5
 *                     dia_semana:
 *                       type: integer
 *                       example: 1
 *                     hora_apertura:
 *                       type: string
 *                       example: "08:00:00"
 *                     hora_cierre:
 *                       type: string
 *                       example: "18:00:00"
 *                     activo:
 *                       type: boolean
 *                       example: true
 *
 *       400:
 *         description: Error de validación
 *
 *       401:
 *         description: Token inválido o no proporcionado
 *
 *       403:
 *         description: No autorizado
 *
 *       404:
 *         description: La sucursal no existe
 *
 *       409:
 *         description: Ya existe un horario registrado para ese día
 *
 *       500:
 *         description: Error interno del servidor
 */

router.post(
  "/sucursales/:id_sucursal/horarios",
  authMiddleware,
  authorize("configuracion", "editar"),
  createHorario
);



export default router;
