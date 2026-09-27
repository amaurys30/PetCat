import express from "express";
import * as controller from "./disponibilidad.controller.js";
import {
  createExcepcionBody,
  disponibilidadEfectivaQuery,
  idDisponibilidadParams,
  idEmpleadoParams,
  listDisponibilidadQuery,
  putHorarioSemanalBody,
  updateExcepcionBody,
} from "./disponibilidad.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { authorize, authorizeAny } from "../../shared/middlewares/authorize.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

// Lectura: quien gestiona la configuración o agenda citas, y el propio empleado.
const ver = authorizeAny(
  [
    ["configuracion", "ver"],
    ["citas", "ver"],
  ],
  { permitirSi: (req, acceso) => acceso.id_empleado === req.params.id_empleado }
);
const editar = authorize("configuracion", "editar");

/**
 * @swagger
 * components:
 *   schemas:
 *     RangoSemanal:
 *       type: object
 *       additionalProperties: false
 *       required: [dia_semana, hora_inicio, hora_fin]
 *       properties:
 *         dia_semana: { type: integer, minimum: 0, maximum: 6, description: "0 = domingo ... 6 = sábado" }
 *         hora_inicio: { type: string, example: "08:00", description: HH:MM (acepta HH:MM:SS) }
 *         hora_fin: { type: string, example: "12:00", description: Posterior a hora_inicio }
 *         id_sucursal: { type: integer, nullable: true, description: null = cualquier sucursal del negocio }
 *     HorarioSemanal:
 *       type: object
 *       properties:
 *         id_disponibilidad: { type: integer }
 *         dia_semana: { type: integer }
 *         hora_inicio: { type: string, example: "08:00" }
 *         hora_fin: { type: string, example: "12:00" }
 *         id_sucursal: { type: integer, nullable: true }
 *     ExcepcionInput:
 *       type: object
 *       description: >
 *         Según `tipo` (un campo que el tipo no tiene da 422):
 *         `bloqueo`: fecha_especifica, fecha_fin opcional, hora_inicio/hora_fin opcionales y juntas
 *         (sin horas = días completos; con horas, ese rango cada día del período).
 *         `vacacion`: fecha_especifica y fecha_fin opcional (días completos).
 *         `evento_especial`: fecha_especifica, hora_inicio, hora_fin e id_sucursal (un solo día; suma ese
 *         rango a la disponibilidad sin recortarlo por el horario de la sucursal; no se cruza con otros
 *         eventos del empleado ese día). Período máximo de 366 días. Al crear, el último día debe ser hoy
 *         o posterior.
 *       required: [tipo, fecha_especifica]
 *       properties:
 *         tipo: { type: string, enum: [bloqueo, vacacion, evento_especial] }
 *         fecha_especifica: { type: string, format: date, description: Primer día }
 *         fecha_fin: { type: string, format: date, nullable: true, description: Último día (bloqueo y vacación) }
 *         hora_inicio: { type: string, example: "14:00" }
 *         hora_fin: { type: string, example: "17:00" }
 *         id_sucursal: { type: integer, description: Solo evento_especial (obligatorio) }
 *         motivo: { type: string, maxLength: 200, nullable: true }
 *     Excepcion:
 *       type: object
 *       properties:
 *         id_disponibilidad: { type: integer }
 *         id_empleado: { type: integer }
 *         tipo: { type: string, enum: [bloqueo, vacacion, evento_especial] }
 *         fecha_especifica: { type: string, format: date }
 *         fecha_fin: { type: string, format: date, nullable: true }
 *         hora_inicio: { type: string, nullable: true }
 *         hora_fin: { type: string, nullable: true }
 *         id_sucursal: { type: integer, nullable: true }
 *         motivo: { type: string, nullable: true }
 *     CitaAfectada:
 *       type: object
 *       description: Cita futura pendiente o confirmada del empleado que ya no cabe en su disponibilidad
 *       properties:
 *         id_cita: { type: integer }
 *         fecha: { type: string, format: date }
 *         hora_inicio: { type: string, example: "09:00" }
 *         hora_fin: { type: string, example: "09:30" }
 *         estado: { type: string, enum: [pendiente, confirmada] }
 *         sucursal:
 *           type: object
 *           nullable: true
 *           properties:
 *             id_sucursal: { type: integer }
 *             nombre: { type: string }
 *         servicio:
 *           type: object
 *           properties:
 *             id_servicio: { type: integer }
 *             nombre: { type: string }
 *         mascota:
 *           type: object
 *           properties:
 *             id_mascota: { type: integer }
 *             nombre: { type: string }
 *         cliente:
 *           type: object
 *           properties:
 *             id_usuario: { type: integer }
 *             nombre: { type: string }
 *             apellido: { type: string }
 *             telefono: { type: string, nullable: true }
 *     CitasAfectadas:
 *       type: array
 *       description: >
 *         Siempre viene (vacía si no hay). Citas futuras pendientes o confirmadas del empleado que, tras el
 *         cambio, no caben en su disponibilidad: el panel debe reprogramarlas o reasignarlas. El cambio se
 *         guarda igual.
 *       items: { $ref: '#/components/schemas/CitaAfectada' }
 *   responses:
 *     EmpleadoInactivo:
 *       description: El empleado está inactivo
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ErrorResponse' }
 *           example: { success: false, message: "El empleado está inactivo: reactívalo antes de cambiar su disponibilidad" }
 */

/**
 * @swagger
 * /empleados/{id_empleado}/disponibilidad:
 *   parameters:
 *     - { in: path, name: id_empleado, required: true, schema: { type: integer } }
 *   get:
 *     summary: Horario semanal y excepciones del empleado
 *     description: >
 *       Requiere `configuracion.ver` o `citas.ver`; el propio empleado siempre puede ver la suya.
 *       Las excepciones se filtran por período (por defecto, las que terminan hoy o después).
 *       `sigue_horario_sucursal` es true si no tiene horario semanal.
 *     tags: [Disponibilidad]
 *     parameters:
 *       - { in: query, name: desde, schema: { type: string, format: date }, description: Por defecto hoy }
 *       - { in: query, name: hasta, schema: { type: string, format: date } }
 *       - { in: query, name: tipo, schema: { type: string, enum: [bloqueo, vacacion, evento_especial] } }
 *     responses:
 *       200:
 *         description: Disponibilidad
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data:
 *                   type: object
 *                   properties:
 *                     horario_semanal: { type: array, items: { $ref: '#/components/schemas/HorarioSemanal' } }
 *                     sigue_horario_sucursal: { type: boolean }
 *                     excepciones: { type: array, items: { $ref: '#/components/schemas/Excepcion' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   post:
 *     summary: Registrar un bloqueo, vacaciones o un evento especial
 *     description: >
 *       Requiere `configuracion.editar`. Se guarda aunque el empleado tenga citas en esas fechas: la
 *       respuesta trae `citas_afectadas` para reprogramarlas o reasignarlas.
 *     tags: [Disponibilidad]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ExcepcionInput' }
 *           examples:
 *             vacaciones: { value: { tipo: vacacion, fecha_especifica: "2026-12-20", fecha_fin: "2027-01-05", motivo: Vacaciones de fin de año } }
 *             bloqueo: { value: { tipo: bloqueo, fecha_especifica: "2026-10-05", hora_inicio: "08:00", hora_fin: "10:00", motivo: Cita médica } }
 *             jornada: { value: { tipo: evento_especial, fecha_especifica: "2026-10-11", hora_inicio: "09:00", hora_fin: "13:00", id_sucursal: 1, motivo: Jornada de vacunación } }
 *     responses:
 *       201:
 *         description: Registrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Bloqueo registrado. 2 citas quedan fuera de la disponibilidad del empleado }
 *                 data:
 *                   type: object
 *                   properties:
 *                     disponibilidad: { $ref: '#/components/schemas/Excepcion' }
 *                     citas_afectadas: { $ref: '#/components/schemas/CitasAfectadas' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/EmpleadoInactivo' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/empleados/:id_empleado/disponibilidad",
  authMiddleware,
  validate({ params: idEmpleadoParams, query: listDisponibilidadQuery }),
  ver,
  controller.getDisponibilidad
);

router.post(
  "/empleados/:id_empleado/disponibilidad",
  authMiddleware,
  validate({ params: idEmpleadoParams, body: createExcepcionBody }),
  editar,
  controller.createExcepcion
);

/**
 * @swagger
 * /empleados/{id_empleado}/horario-semanal:
 *   put:
 *     summary: Reemplazar el horario semanal del empleado
 *     description: >
 *       Requiere `configuracion.editar`. Reemplaza todo el horario normal en una transacción. Lista vacía:
 *       el empleado sigue el horario de la sucursal. Los rangos de un mismo día no se cruzan, aunque sean
 *       de sucursales distintas (pueden tocarse); el 422 indica el índice (`horarios.N`). La disponibilidad
 *       real es este horario recortado por el de la sucursal. La respuesta trae `citas_afectadas`.
 *     tags: [Disponibilidad]
 *     parameters:
 *       - { in: path, name: id_empleado, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [horarios]
 *             properties:
 *               horarios: { type: array, maxItems: 42, items: { $ref: '#/components/schemas/RangoSemanal' } }
 *           example:
 *             horarios:
 *               - { dia_semana: 1, hora_inicio: "08:00", hora_fin: "12:00" }
 *               - { dia_semana: 3, hora_inicio: "14:00", hora_fin: "18:00", id_sucursal: 2 }
 *     responses:
 *       200:
 *         description: Horario actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Horario semanal actualizado }
 *                 data:
 *                   type: object
 *                   properties:
 *                     horario_semanal: { type: array, items: { $ref: '#/components/schemas/HorarioSemanal' } }
 *                     citas_afectadas: { $ref: '#/components/schemas/CitasAfectadas' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/EmpleadoInactivo' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.put(
  "/empleados/:id_empleado/horario-semanal",
  authMiddleware,
  validate({ params: idEmpleadoParams, body: putHorarioSemanalBody }),
  editar,
  controller.replaceHorarioSemanal
);

/**
 * @swagger
 * /empleados/{id_empleado}/disponibilidad-efectiva:
 *   get:
 *     summary: Rangos disponibles del empleado en una fecha
 *     description: >
 *       Mismos permisos que ver la disponibilidad. Para cada sucursal activa (o solo `id_sucursal`):
 *       horario normal (o el de la sucursal si no tiene) recortado por el horario de la sucursal, menos
 *       sus eventos en otra sucursal, más sus eventos en esta, menos bloqueos y vacaciones. Un empleado
 *       inactivo no tiene rangos. No descuenta citas (eso lo hace la búsqueda de horarios libres).
 *     tags: [Disponibilidad]
 *     parameters:
 *       - { in: path, name: id_empleado, required: true, schema: { type: integer } }
 *       - { in: query, name: fecha, required: true, schema: { type: string, format: date } }
 *       - { in: query, name: id_sucursal, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Disponibilidad del día
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data:
 *                   type: object
 *                   properties:
 *                     fecha: { type: string, format: date }
 *                     dia_semana: { type: integer }
 *                     sigue_horario_sucursal: { type: boolean }
 *                     sucursales:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id_sucursal: { type: integer }
 *                           nombre: { type: string }
 *                           rangos:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 hora_inicio: { type: string, example: "08:00" }
 *                                 hora_fin: { type: string, example: "12:00" }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/empleados/:id_empleado/disponibilidad-efectiva",
  authMiddleware,
  validate({ params: idEmpleadoParams, query: disponibilidadEfectivaQuery }),
  ver,
  controller.getDisponibilidadEfectiva
);

/**
 * @swagger
 * /disponibilidad/{id_disponibilidad}:
 *   parameters:
 *     - { in: path, name: id_disponibilidad, required: true, schema: { type: integer } }
 *   patch:
 *     summary: Editar un bloqueo, vacaciones o un evento especial
 *     description: >
 *       Requiere `configuracion.editar`. El tipo no cambia; los campos se combinan con los actuales y se
 *       validan con las reglas del tipo. El horario semanal se cambia con el PUT (409). Trae `citas_afectadas`.
 *     tags: [Disponibilidad]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             minProperties: 1
 *             properties:
 *               fecha_especifica: { type: string, format: date }
 *               fecha_fin: { type: string, format: date, nullable: true }
 *               hora_inicio: { type: string, nullable: true }
 *               hora_fin: { type: string, nullable: true }
 *               id_sucursal: { type: integer }
 *               motivo: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Disponibilidad actualizada }
 *                 data:
 *                   type: object
 *                   properties:
 *                     disponibilidad: { $ref: '#/components/schemas/Excepcion' }
 *                     citas_afectadas: { $ref: '#/components/schemas/CitasAfectadas' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Es parte del horario semanal, o el empleado está inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   delete:
 *     summary: Eliminar un bloqueo, vacaciones o un evento especial
 *     description: >
 *       Requiere `configuracion.editar`. Borrado lógico. Quitar un evento especial puede dejar citas fuera
 *       de la disponibilidad: la respuesta trae `citas_afectadas`.
 *     tags: [Disponibilidad]
 *     responses:
 *       200:
 *         description: Eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Disponibilidad eliminada }
 *                 data:
 *                   type: object
 *                   properties:
 *                     citas_afectadas: { $ref: '#/components/schemas/CitasAfectadas' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Es parte del horario semanal, o el empleado está inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.patch(
  "/disponibilidad/:id_disponibilidad",
  authMiddleware,
  validate({ params: idDisponibilidadParams, body: updateExcepcionBody }),
  editar,
  controller.updateExcepcion
);

router.delete(
  "/disponibilidad/:id_disponibilidad",
  authMiddleware,
  validate({ params: idDisponibilidadParams }),
  editar,
  controller.deleteExcepcion
);

export default router;
