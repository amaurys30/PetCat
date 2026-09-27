import express from "express";
import * as controller from "./cita.controller.js";
import { createCitaBody, createCitaPanelBody, horariosLibresQuery } from "./cita.schemas.js";
import { idNegocioParams } from "../negocios/negocio.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { authorize } from "../../shared/middlewares/authorize.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   parameters:
 *     horariosLibresServicio: { in: query, name: id_servicio, required: true, schema: { type: integer } }
 *     horariosLibresSucursal: { in: query, name: id_sucursal, required: true, schema: { type: integer }, description: Sucursal activa del negocio del servicio }
 *     horariosLibresFecha: { in: query, name: fecha, required: true, schema: { type: string, format: date }, description: Desde hoy hasta hoy + horizonte_reserva_dias (60) }
 *     horariosLibresEmpleado: { in: query, name: id_empleado, schema: { type: integer }, description: Solo ese empleado (debe atender el servicio) }
 *   schemas:
 *     HorariosLibres:
 *       type: object
 *       properties:
 *         fecha: { type: string, format: date }
 *         servicio:
 *           type: object
 *           properties:
 *             id_servicio: { type: integer }
 *             nombre: { type: string }
 *             duracion_minutos: { type: integer }
 *             precio_actual: { type: number }
 *         sucursal:
 *           type: object
 *           properties:
 *             id_sucursal: { type: integer }
 *             nombre: { type: string }
 *         horarios:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               hora_inicio: { type: string, example: "09:15" }
 *               hora_fin: { type: string, example: "09:45", description: Sin el margen del servicio }
 *               empleados:
 *                 type: array
 *                 items: { $ref: '#/components/schemas/EmpleadoAsignado' }
 *         motivo_sin_horarios:
 *           type: string
 *           nullable: true
 *           example: El servicio no se ofrece los domingos
 *           description: Por qué no hay horarios (null si los hay)
 *     CitaReservaInput:
 *       type: object
 *       additionalProperties: false
 *       required: [id_servicio, id_sucursal, fecha, hora_inicio, id_mascota]
 *       properties:
 *         id_servicio: { type: integer }
 *         id_sucursal: { type: integer }
 *         fecha: { type: string, format: date }
 *         hora_inicio: { type: string, example: "09:15", description: De la cuadrícula de 15 minutos }
 *         id_mascota: { type: integer }
 *         id_empleado: { type: integer, description: Opcional; sin él se asigna al empleado libre con menos citas ese día }
 *         notas_cliente: { type: string, maxLength: 2000 }
 *     Cita:
 *       type: object
 *       properties:
 *         id_cita: { type: integer }
 *         fecha: { type: string, format: date }
 *         hora_inicio: { type: string, example: "09:15" }
 *         hora_fin: { type: string, example: "09:45" }
 *         estado: { type: string, enum: [pendiente, confirmada, en_curso, completada, cancelada, no_asistio, reprogramada] }
 *         origen: { type: string, enum: [app_movil, panel_web, whatsapp, presencial, telefono] }
 *         prioridad: { type: string, enum: [normal, alta, urgente] }
 *         precio_estimado: { type: number, description: Precio actual del servicio al reservar (con la oferta vigente) }
 *         precio_final: { type: number, nullable: true }
 *         notas_cliente: { type: string, nullable: true }
 *         notas_internas: { type: string, nullable: true, description: Solo en el panel }
 *         id_cita_origen: { type: integer, nullable: true }
 *         negocio: { type: object, properties: { id_negocio: { type: integer }, nombre: { type: string } } }
 *         sucursal:
 *           type: object
 *           nullable: true
 *           properties: { id_sucursal: { type: integer }, nombre: { type: string }, direccion: { type: string } }
 *         servicio:
 *           type: object
 *           properties: { id_servicio: { type: integer }, nombre: { type: string }, duracion_minutos: { type: integer } }
 *         empleado:
 *           type: object
 *           nullable: true
 *           properties: { id_empleado: { type: integer }, nombre: { type: string }, apellido: { type: string } }
 *         mascota:
 *           type: object
 *           properties: { id_mascota: { type: integer }, nombre: { type: string }, especie: { type: string } }
 *         cliente:
 *           type: object
 *           properties:
 *             id_usuario: { type: integer }
 *             nombre: { type: string }
 *             apellido: { type: string }
 *             telefono: { type: string, nullable: true }
 *         fecha_creacion: { type: string }
 *   responses:
 *     ReservaConflicto:
 *       description: >
 *         El servicio no requiere cita o no tiene profesionales asignados; no se ofrece ese día o no
 *         quedan cupos; el horario ya no está libre; la mascota está fallecida o ya tiene otra cita a esa hora.
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ErrorResponse' }
 *           example: { success: false, message: "El horario ya no está disponible: elige otro" }
 */

/**
 * @swagger
 * /citas/horarios-libres:
 *   get:
 *     summary: Horarios libres para reservar (app)
 *     description: >
 *       Público. Para el servicio (activo y visible en la app, de un negocio activo) en la sucursal y la
 *       fecha: por cada empleado que lo atiende, su disponibilidad efectiva menos sus citas (contando el
 *       margen del servicio de cada una), en la cuadrícula de 15 minutos y con al menos
 *       `antelacion_minima_reserva_min` (60) de anticipación. Sin horarios responde 200 con la lista vacía
 *       y `motivo_sin_horarios`.
 *     tags: [Citas]
 *     security: []
 *     parameters:
 *       - $ref: '#/components/parameters/horariosLibresServicio'
 *       - $ref: '#/components/parameters/horariosLibresSucursal'
 *       - $ref: '#/components/parameters/horariosLibresFecha'
 *       - $ref: '#/components/parameters/horariosLibresEmpleado'
 *     responses:
 *       200:
 *         description: Horarios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { $ref: '#/components/schemas/HorariosLibres' }
 *       409:
 *         description: El servicio no requiere cita o no tiene profesionales asignados
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       422:
 *         description: Servicio, sucursal o empleado inválidos; fecha pasada o después del horizonte
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get("/citas/horarios-libres", validate({ query: horariosLibresQuery }), controller.getHorariosLibres);

/**
 * @swagger
 * /citas:
 *   post:
 *     summary: Reservar una cita (app)
 *     description: >
 *       La mascota debe ser del usuario, estar viva y ser de una especie y un peso que el servicio
 *       atiende. Se comprueba el horario dentro de una transacción (servicio, empleados y mascota
 *       bloqueados): si otra reserva lo tomó antes, 409. La cita queda `pendiente` hasta que el negocio
 *       la confirme. El email sin verificar no impide reservar.
 *     tags: [Citas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CitaReservaInput' }
 *     responses:
 *       201:
 *         description: Cita solicitada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Cita solicitada: el negocio debe confirmarla" }
 *                 data: { $ref: '#/components/schemas/Cita' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       409: { $ref: '#/components/responses/ReservaConflicto' }
 *       422:
 *         description: >
 *           Datos inválidos: servicio, sucursal o empleado; fecha fuera del período; hora fuera de la
 *           cuadrícula; mascota inexistente, eliminada, ajena o que el servicio no atiende (errors.id_mascota).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post("/citas", authMiddleware, validate({ body: createCitaBody }), controller.createCita);

/**
 * @swagger
 * /negocios/{id_negocio}/citas/horarios-libres:
 *   get:
 *     summary: Horarios libres para agendar (panel)
 *     description: >
 *       Requiere `citas.crear`. Igual que el de la app, pero admite servicios ocultos en la app (del
 *       propio negocio) y no aplica la antelación mínima (solo que el horario sea futuro).
 *     tags: [Citas]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *       - $ref: '#/components/parameters/horariosLibresServicio'
 *       - $ref: '#/components/parameters/horariosLibresSucursal'
 *       - $ref: '#/components/parameters/horariosLibresFecha'
 *       - $ref: '#/components/parameters/horariosLibresEmpleado'
 *     responses:
 *       200:
 *         description: Horarios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { $ref: '#/components/schemas/HorariosLibres' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: El servicio no requiere cita o no tiene profesionales asignados
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/negocios/:id_negocio/citas/horarios-libres",
  authMiddleware,
  validate({ params: idNegocioParams, query: horariosLibresQuery }),
  authorize("citas", "crear"),
  controller.getHorariosLibresPanel
);

/**
 * @swagger
 * /negocios/{id_negocio}/citas:
 *   post:
 *     summary: Agendar una cita desde el panel
 *     description: >
 *       Requiere `citas.crear`. Para un cliente (`id_usuario`, p. ej. encontrado con clientes/buscar o
 *       recién registrado) y su mascota. Mismas reglas que la app, con las diferencias del panel (servicios
 *       ocultos, sin antelación mínima). La cita queda `confirmada` y se programa su recordatorio.
 *     tags: [Citas]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/CitaReservaInput'
 *               - type: object
 *                 required: [id_usuario]
 *                 properties:
 *                   id_usuario: { type: integer, description: Cliente dueño de la mascota }
 *                   origen: { type: string, enum: [panel_web, presencial, telefono, whatsapp], default: panel_web }
 *                   prioridad: { type: string, enum: [normal, alta, urgente], default: normal }
 *                   notas_internas: { type: string, maxLength: 2000 }
 *     responses:
 *       201:
 *         description: Cita agendada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Cita agendada y confirmada }
 *                 data: { $ref: '#/components/schemas/Cita' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/ReservaConflicto' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  "/negocios/:id_negocio/citas",
  authMiddleware,
  validate({ params: idNegocioParams, body: createCitaPanelBody }),
  authorize("citas", "crear"),
  controller.createCitaPanel
);

export default router;
