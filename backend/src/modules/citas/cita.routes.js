import express from "express";
import * as controller from "./cita.controller.js";
import {
  actualizarCitaBody,
  agendaQuery,
  atencionQuery,
  cambiarEstadoBody,
  cancelarCitaBody,
  reprogramarCitaBody,
  createCitaBody,
  createCitaPanelBody,
  horariosLibresQuery,
  horariosLibresPanelQuery,
  idCitaParams,
  misCitasQuery,
} from "./cita.schemas.js";
import * as citaRepo from "./cita.repository.js";
import { idNegocioParams } from "../negocios/negocio.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { authorize, authorizeAny, authorizeDuenoO } from "../../shared/middlewares/authorize.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

// La cita es del usuario autenticado (vista del dueño en authorizeDuenoO).
const esDuenoDeLaCita = (req) => citaRepo.esDelUsuario(req.params.id_cita, req.user.id_usuario);

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
 *         notas_internas: { type: string, nullable: true, x-opcional: true, description: Solo en el panel }
 *         id_cita_origen: { type: integer, nullable: true, description: Cita original si esta es una reprogramación }
 *         confirmar_antes_de:
 *           type: string
 *           nullable: true
 *           example: "2026-10-04 15:00:00"
 *           description: >
 *             Solo en citas pendientes: hasta cuándo puede confirmarla el negocio. Si no la confirma, se cancela
 *             sola (cancelacion.por = sistema). Lo que ocurra primero entre 24 horas después de reservar y
 *             60 minutos antes del inicio; si eso cae de madrugada, se corre a una hora después del fin del
 *             horario de silencio (08:00), sin pasar de 30 minutos antes del inicio.
 *         fecha_completada: { type: string, nullable: true, example: "2026-09-20 15:42:10", description: Cuándo pasó a completada }
 *         id_resena: { type: integer, nullable: true, description: Reseña del dueño sobre esta cita (null si no hay o la retiró) }
 *         resena:
 *           type: object
 *           nullable: true
 *           x-opcional: true
 *           description: >
 *             Solo en la vista del dueño (GET /citas/mias y GET /citas/{id_cita}) y solo en citas completadas.
 *             Para mostrar "Reseñar" o "Editar reseña".
 *           properties:
 *             id_resena: { type: integer, nullable: true }
 *             retirada: { type: boolean, description: El dueño retiró su reseña; no puede reseñar otra vez }
 *             resenar_antes_de: { type: string, nullable: true, example: "2026-10-20 15:42:10", description: fecha_completada + 30 días }
 *             puede_resenar: { type: boolean, description: Sin reseña, dentro del plazo y sin ser personal del negocio }
 *             puede_editar: { type: boolean }
 *         cancelacion:
 *           type: object
 *           nullable: true
 *           description: Solo en citas canceladas
 *           properties:
 *             por:
 *               type: string
 *               enum: [dueno, negocio, sistema]
 *               nullable: true
 *               description: "sistema: el negocio no la confirmó a tiempo (nunca es tardía ni cuenta contra el cliente)"
 *             fecha: { type: string, nullable: true }
 *             tardia: { type: boolean, description: El dueño canceló a menos de 2 horas de la cita }
 *             motivo: { type: string, nullable: true }
 *         negocio:
 *           type: object
 *           properties: { id_negocio: { type: integer }, nombre: { type: string }, logo_url: { type: string, nullable: true } }
 *         sucursal:
 *           type: object
 *           nullable: true
 *           description: Dónde es la cita; con teléfono y coordenadas para "Cómo llegar"
 *           properties:
 *             id_sucursal: { type: integer }
 *             nombre: { type: string }
 *             direccion: { type: string }
 *             telefono: { type: string, nullable: true }
 *             latitud: { type: number, nullable: true }
 *             longitud: { type: number, nullable: true }
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
 *       y `motivo_sin_horarios`. Si el negocio alcanzó el límite de citas del mes de su plan, no hay
 *       horarios y el motivo es el genérico ("No hay horarios disponibles para esa fecha").
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
 *       la confirme, con `confirmar_antes_de`: si no la confirma a tiempo se cancela sola. Si el negocio tiene
 *       `confirmacion_automatica`, nace `confirmada` (mensaje "Cita confirmada") con sus recordatorios. El
 *       email sin verificar no impide reservar. Si el negocio alcanzó el límite de citas
 *       del mes de su plan, 409 con el mismo mensaje de horario no disponible (la app no ve el plan).
 *       Avisos: `cita_nueva` al personal con `citas.ver` y al propietario; `plan_limite_80` si la reserva
 *       cruza el 80 % del límite (una vez al mes) y `plan_limite_alcanzado` si se rechaza por el límite
 *       (una vez al día), al propietario y a quien tiene `configuracion.editar`.
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
 *                 message:
 *                   type: string
 *                   enum: ["Cita solicitada: el negocio debe confirmarla", Cita confirmada]
 *                   example: "Cita solicitada: el negocio debe confirmarla"
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
 * components:
 *   schemas:
 *     CitaPanel:
 *       allOf:
 *         - $ref: '#/components/schemas/Cita'
 *         - type: object
 *           properties:
 *             fuera_de_disponibilidad:
 *               type: boolean
 *               description: >
 *                 Cita futura pendiente o confirmada que ya no cabe en la disponibilidad de su empleado
 *                 (bloqueo, vacaciones, cambio de horario): hay que reprogramarla o reasignarla.
 *                 false en las demás.
 *             motivo_fuera:
 *               type: object
 *               nullable: true
 *               description: Solo si `fuera_de_disponibilidad` es true; null en las demás.
 *               properties:
 *                 tipo:
 *                   type: string
 *                   enum: [vacacion, bloqueo, fuera_de_horario]
 *                   description: >
 *                     vacacion o bloqueo (la excepción que se cruza con la cita; la vacación gana) o
 *                     fuera_de_horario (cambió el horario del empleado o de la sucursal, o tiene un evento en otra sucursal)
 *                 motivo:
 *                   type: string
 *                   nullable: true
 *                   example: Capacitación
 *                   description: >
 *                     Texto de la vacación o del bloqueo. Puede ser personal: solo se envía a quien tiene
 *                     `configuracion.ver` (y al propietario y al admin) y al propio empleado de la cita
 *                     (es su información); a los demás, null.
 *     CitaPanelDetalle:
 *       description: Detalle de la cita para el panel (GET /citas/{id_cita} y respuestas de los cambios).
 *       allOf:
 *         - $ref: '#/components/schemas/CitaPanel'
 *         - type: object
 *           properties:
 *             mascota:
 *               type: object
 *               description: Perfil de la mascota que muestra el detalle (B4), además de id, nombre y especie
 *               properties:
 *                 raza: { type: string, nullable: true }
 *                 edad_meses: { type: integer, nullable: true, description: Calculada con la fecha de nacimiento }
 *                 peso: { type: number, nullable: true }
 *                 tiene_alergias: { type: boolean }
 *                 alergias_detalle: { type: string, nullable: true }
 *                 fallecido: { type: boolean }
 *             cliente:
 *               type: object
 *               properties:
 *                 email: { type: string, format: email, description: Para contactarlo por su cita, como el teléfono (el perfil completo exige clientes.ver) }
 *                 usa_app: { type: boolean, description: Alguna vez inició sesión }
 *                 historial_cumplimiento:
 *                   type: object
 *                   description: Solo las citas del cliente con este negocio, nunca las de otros negocios
 *                   properties:
 *                     completadas: { type: integer }
 *                     inasistencias: { type: integer }
 *                     cancelaciones_tardias: { type: integer }
 */

/**
 * @swagger
 * /citas/mias:
 *   get:
 *     summary: Mis citas (app)
 *     description: >
 *       Citas del usuario autenticado, paginadas, sin notas internas. `proximas` (por defecto: las que no
 *       han terminado, de la más cercana a la más lejana), `pasadas` o `todas` (de la más reciente hacia atrás).
 *       Cada cita trae el negocio (con logo) y la sucursal con teléfono y coordenadas.
 *     tags: [Citas]
 *     parameters:
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - { in: query, name: alcance, schema: { type: string, enum: [proximas, pasadas, todas], default: proximas } }
 *       - { in: query, name: estado, schema: { type: string }, example: "pendiente,confirmada", description: Uno o varios estados separados por coma }
 *       - { in: query, name: id_mascota, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Página de citas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Cita' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get("/citas/mias", authMiddleware, validate({ query: misCitasQuery }), controller.getMisCitas);

/**
 * @swagger
 * /citas/{id_cita}:
 *   get:
 *     summary: Detalle de una cita (dueño o negocio)
 *     description: >
 *       El personal del negocio de la cita con `citas.ver` (y el propietario y el admin) recibe la vista
 *       completa, con notas internas y `fuera_de_disponibilidad`. El dueño de la cita recibe la vista sin
 *       notas internas. Si es personal y además dueño, recibe la del personal. Cualquier otro, incluido el
 *       personal de otros negocios: 403.
 *     tags: [Citas]
 *     parameters:
 *       - { in: path, name: id_cita, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Cita
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/CitaPanelDetalle'
 *                     - $ref: '#/components/schemas/Cita'
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/citas/:id_cita",
  authMiddleware,
  validate({ params: idCitaParams }),
  authorizeDuenoO("citas", "ver", { esDueno: esDuenoDeLaCita }),
  controller.getCita
);


/**
 * @swagger
 * components:
 *   responses:
 *     CitaDetalleRespuesta:
 *       description: La cita actualizada (vista del panel, o del dueño si actuó el dueño)
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success: { type: boolean, example: true }
 *               message: { type: string }
 *               data:
 *                 oneOf:
 *                   - $ref: '#/components/schemas/CitaPanelDetalle'
 *                   - $ref: '#/components/schemas/Cita'
 *     CitaEstadoConflicto:
 *       description: El cambio no es posible en el estado o el momento actual de la cita
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ErrorResponse' }
 *           example: { success: false, message: "No se puede pasar de pendiente a completada: desde pendiente solo a confirmada" }
 */

/**
 * @swagger
 * /citas/{id_cita}/estado:
 *   patch:
 *     summary: Cambiar el estado de una cita (panel)
 *     description: >
 *       Requiere `citas.editar`. Transiciones: pendiente → confirmada (se programa el recordatorio);
 *       confirmada → en_curso (desde la fecha de la cita) o no_asistio (desde la hora de inicio);
 *       en_curso → completada (con `precio_final`, por defecto el estimado; suma al total de citas del
 *       negocio, guarda `fecha_completada` y programa la invitación a reseñar para 3 horas después, o las
 *       10:00 si cae entre las 20:00 y las 10:00); no_asistio → en_curso solo el mismo día (el cliente llegó tarde). completada, cancelada y
 *       reprogramada son finales. Para cancelar o reprogramar hay endpoints propios. Queda en el historial.
 *       Al confirmar se avisa al dueño (`cita_confirmada`).
 *     tags: [Citas]
 *     parameters:
 *       - { in: path, name: id_cita, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [estado]
 *             properties:
 *               estado: { type: string, enum: [confirmada, en_curso, no_asistio, completada] }
 *               motivo: { type: string, maxLength: 300 }
 *               precio_final: { type: number, minimum: 0, description: Solo al completar }
 *     responses:
 *       200: { $ref: '#/components/responses/CitaDetalleRespuesta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/CitaEstadoConflicto' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.patch(
  "/citas/:id_cita/estado",
  authMiddleware,
  validate({ params: idCitaParams, body: cambiarEstadoBody }),
  authorize("citas", "editar"),
  controller.cambiarEstado
);

/**
 * @swagger
 * /citas/{id_cita}/cancelar:
 *   post:
 *     summary: Cancelar una cita (dueño o negocio)
 *     description: >
 *       Solo citas pendientes o confirmadas. El dueño puede cancelar siempre que la cita no haya empezado
 *       (409 después); si faltan menos de `antelacion_cancelacion_app_h` (2) horas queda como cancelación
 *       tardía, que el panel ve. El negocio (`citas.cancelar`) exige motivo. Se guarda quién canceló y
 *       cuándo, y se cancelan los recordatorios pendientes. Aviso `cita_cancelada` a la otra parte: al
 *       personal con `citas.ver` y al propietario si cancela el dueño; al dueño si cancela el negocio.
 *     tags: [Citas]
 *     parameters:
 *       - { in: path, name: id_cita, required: true, schema: { type: integer } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             properties:
 *               motivo: { type: string, maxLength: 300, description: Obligatorio si cancela el negocio }
 *     responses:
 *       200: { $ref: '#/components/responses/CitaDetalleRespuesta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/CitaEstadoConflicto' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  "/citas/:id_cita/cancelar",
  authMiddleware,
  validate({ params: idCitaParams, body: cancelarCitaBody }),
  authorizeDuenoO("citas", "cancelar", { esDueno: esDuenoDeLaCita }),
  controller.cancelarCita
);

/**
 * @swagger
 * /citas/{id_cita}/reprogramar:
 *   post:
 *     summary: Reprogramar una cita (dueño o negocio)
 *     description: >
 *       Solo citas pendientes o confirmadas. Crea una cita nueva (con `id_cita_origen`) con el mismo cálculo
 *       de horarios libres y la misma protección contra reservas simultáneas, y marca la original como
 *       `reprogramada`, en una transacción: si el horario nuevo no está libre (409) la original no cambia.
 *       El dueño lo hace con las reglas de la app y hasta 2 horas antes de la cita original; la nueva queda
 *       `pendiente` (o `confirmada` si el negocio tiene `confirmacion_automatica`). El negocio (`citas.editar`), en cualquier momento y con las reglas del panel; la nueva queda
 *       `confirmada`. Conserva servicio, mascota, precio estimado, origen, notas y prioridad; por defecto la
 *       misma sucursal. Una mascota fallecida no se reprograma (409). La nueva cita cuenta para el límite de
 *       citas del mes del plan (la original deja de contar): si el mes nuevo está lleno, el dueño recibe el
 *       409 de horario no disponible y el negocio 403 con `errors.plan`. Aviso `cita_reprogramada` (con la
 *       fecha anterior) a la otra parte, como en la cancelación.
 *     tags: [Citas]
 *     parameters:
 *       - { in: path, name: id_cita, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [fecha, hora_inicio]
 *             properties:
 *               fecha: { type: string, format: date }
 *               hora_inicio: { type: string, example: "10:30" }
 *               id_empleado: { type: integer, description: Opcional; sin él se asigna al empleado libre con menos citas }
 *               id_sucursal: { type: integer, description: Por defecto la de la cita original }
 *               motivo: { type: string, maxLength: 300 }
 *     responses:
 *       201:
 *         description: La cita nueva
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Cita reprogramada }
 *                 data: { $ref: '#/components/schemas/Cita' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/ForbiddenOrPlanLimit' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/ReservaConflicto' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  "/citas/:id_cita/reprogramar",
  authMiddleware,
  validate({ params: idCitaParams, body: reprogramarCitaBody }),
  authorizeDuenoO("citas", "editar", { esDueno: esDuenoDeLaCita }),
  controller.reprogramarCita
);

/**
 * @swagger
 * /citas/{id_cita}:
 *   patch:
 *     summary: Editar una cita (panel)
 *     description: >
 *       Requiere `citas.editar`. Al menos un campo. `precio_final` solo en citas en curso o completadas.
 *       `id_empleado` (reasignar) solo en pendientes o confirmadas: el empleado debe atender el servicio y
 *       estar libre a esa hora (disponibilidad y otras citas, con el mismo cálculo de la reserva); si no, 409.
 *       Cada campo que cambia queda en el historial.
 *     tags: [Citas]
 *     parameters:
 *       - { in: path, name: id_cita, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             minProperties: 1
 *             properties:
 *               notas_internas: { type: string, nullable: true, maxLength: 2000 }
 *               prioridad: { type: string, enum: [normal, alta, urgente] }
 *               precio_final: { type: number, nullable: true, minimum: 0 }
 *               id_empleado: { type: integer }
 *     responses:
 *       200: { $ref: '#/components/responses/CitaDetalleRespuesta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/CitaEstadoConflicto' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.patch(
  "/citas/:id_cita",
  authMiddleware,
  validate({ params: idCitaParams, body: actualizarCitaBody }),
  authorize("citas", "editar"),
  controller.actualizarCita
);

/**
 * @swagger
 * /citas/{id_cita}/profesionales-libres:
 *   get:
 *     summary: Profesionales libres para reasignar una cita (panel)
 *     description: >
 *       Requiere `citas.editar`. Cada profesional activo que atiende el servicio, con `libre` si puede tomar
 *       la cita a su hora (disponibilidad y otras citas, con el mismo cálculo de la reserva y sin contar esta
 *       cita) y, si no, el motivo. `actual` marca a quien la tiene ahora. Solo citas pendientes o confirmadas
 *       (409). Para reasignar: `PATCH /citas/{id_cita}` con `id_empleado`.
 *     tags: [Citas]
 *     parameters:
 *       - { in: path, name: id_cita, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Profesionales
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
 *                     id_cita: { type: integer }
 *                     fecha: { type: string, format: date }
 *                     hora_inicio: { type: string, example: "15:30" }
 *                     hora_fin: { type: string, example: "16:00" }
 *                     profesionales:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id_empleado: { type: integer }
 *                           nombre: { type: string }
 *                           apellido: { type: string }
 *                           actual: { type: boolean }
 *                           libre: { type: boolean }
 *                           motivo:
 *                             type: string
 *                             nullable: true
 *                             example: Tiene otra cita a esa hora
 *                             description: Por qué no está libre (null si lo está)
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/CitaEstadoConflicto' }
 */
router.get(
  "/citas/:id_cita/profesionales-libres",
  authMiddleware,
  validate({ params: idCitaParams }),
  authorize("citas", "editar"),
  controller.getProfesionalesLibres
);

/**
 * @swagger
 * /citas/{id_cita}/historial:
 *   get:
 *     summary: Historial de cambios de una cita (dueño o negocio)
 *     description: >
 *       Del más antiguo al más reciente. El personal del negocio con `citas.ver` ve todos los cambios con
 *       el usuario y el empleado que los hizo. El dueño ve solo los cambios de estado y de empleado, con su
 *       motivo, y `realizado_por` (dueno, negocio o sistema: la cancelación automática), sin nombres del personal.
 *     tags: [Citas]
 *     parameters:
 *       - { in: path, name: id_cita, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Historial
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
 *                     type: object
 *                     properties:
 *                       fecha_cambio: { type: string }
 *                       campo: { type: string, enum: [estado, empleado, notas_internas, prioridad, precio_final] }
 *                       valor_anterior: { type: string, nullable: true, description: En empleado, su nombre }
 *                       valor_nuevo: { type: string, nullable: true }
 *                       motivo: { type: string, nullable: true }
 *                       realizado_por: { type: string, enum: [dueno, negocio, sistema] }
 *                       usuario:
 *                         type: object
 *                         nullable: true
 *                         x-opcional: true
 *                         description: Solo en el panel. Quién hizo el cambio (null en los del sistema)
 *                         properties: { id_usuario: { type: integer }, nombre: { type: string }, apellido: { type: string } }
 *                       empleado:
 *                         type: object
 *                         nullable: true
 *                         x-opcional: true
 *                         description: Solo en el panel. Su perfil de empleado en el negocio, si lo tiene
 *                         properties: { id_empleado: { type: integer }, nombre: { type: string }, apellido: { type: string } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/citas/:id_cita/historial",
  authMiddleware,
  validate({ params: idCitaParams }),
  authorizeDuenoO("citas", "ver", { esDueno: esDuenoDeLaCita }),
  controller.getHistorial
);

/**
 * @swagger
 * /negocios/{id_negocio}/citas/horarios-libres:
 *   get:
 *     summary: Horarios libres para agendar (panel)
 *     description: >
 *       Requiere `citas.crear` o `citas.editar` (agendar o reprogramar). Igual que el de la app, pero admite
 *       servicios ocultos en la app (del propio negocio) y no aplica la antelación mínima (solo que el horario
 *       sea futuro). Con `id_cita_excluir` (reprogramar), esa cita no ocupa su hora ni cuenta en los cupos ni
 *       en el límite del plan; debe ser de este negocio (422) y exige `citas.editar` (403). Si el negocio
 *       alcanzó el límite de citas del mes de su plan, no hay horarios y `motivo_sin_horarios` lo dice
 *       ("El negocio alcanzó las 30 citas de su plan Gratuito en octubre de 2026").
 *     tags: [Citas]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *       - $ref: '#/components/parameters/horariosLibresServicio'
 *       - $ref: '#/components/parameters/horariosLibresSucursal'
 *       - $ref: '#/components/parameters/horariosLibresFecha'
 *       - $ref: '#/components/parameters/horariosLibresEmpleado'
 *       - { in: query, name: id_cita_excluir, schema: { type: integer }, description: Cita que se reprograma (no ocupa su hora) }
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
  validate({ params: idNegocioParams, query: horariosLibresPanelQuery }),
  authorizeAny([
    ["citas", "crear"],
    ["citas", "editar"],
  ]),
  controller.getHorariosLibresPanel
);

/**
 * @swagger
 * /negocios/{id_negocio}/citas:
 *   get:
 *     summary: Agenda del negocio (panel)
 *     description: >
 *       Requiere `citas.ver`. Citas del negocio entre `desde` y `hasta` (por defecto hoy; máximo 31 días),
 *       por fecha y hora, sin paginar (`meta.total`). Filtros: estados, sucursal, empleado y servicio (deben
 *       ser del negocio: 422 si no), `q` (nombre del cliente o de la mascota), `solo_mias` (las del perfil de
 *       empleado de quien consulta en este negocio; 422 si no tiene) y `fuera_de_disponibilidad`.
 *     tags: [Citas]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *       - { in: query, name: desde, schema: { type: string, format: date } }
 *       - { in: query, name: hasta, schema: { type: string, format: date }, description: Máximo 31 días desde `desde` }
 *       - { in: query, name: estado, schema: { type: string }, example: "pendiente,confirmada" }
 *       - { in: query, name: id_sucursal, schema: { type: integer } }
 *       - { in: query, name: id_empleado, schema: { type: integer } }
 *       - { in: query, name: id_servicio, schema: { type: integer } }
 *       - { in: query, name: q, schema: { type: string, maxLength: 100 } }
 *       - { in: query, name: solo_mias, schema: { type: string, enum: ["true", "false"] } }
 *       - { in: query, name: fuera_de_disponibilidad, schema: { type: string, enum: ["true", "false"] } }
 *     responses:
 *       200:
 *         description: Agenda
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { type: array, items: { $ref: '#/components/schemas/CitaPanel' } }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     desde: { type: string, format: date }
 *                     hasta: { type: string, format: date }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   post:
 *     summary: Agendar una cita desde el panel
 *     description: >
 *       Requiere `citas.crear`. Para un cliente (`id_usuario`, p. ej. encontrado con clientes/buscar o
 *       recién registrado) y su mascota. Mismas reglas que la app, con las diferencias del panel (servicios
 *       ocultos, sin antelación mínima). La cita queda `confirmada` y se programa su recordatorio.
 *       403 con `errors.plan` si el negocio alcanzó el límite de citas del mes de la cita en su plan.
 *       Avisa al dueño (`cita_agendada`, por correo si no tiene la app) y, como la reserva de la app,
 *       `plan_limite_80` y `plan_limite_alcanzado` al negocio.
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
 *       403: { $ref: '#/components/responses/ForbiddenOrPlanLimit' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/ReservaConflicto' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
/**
 * @swagger
 * /negocios/{id_negocio}/citas/atencion:
 *   get:
 *     summary: Citas por confirmar y fuera de disponibilidad (panel)
 *     description: >
 *       Requiere `citas.ver`. Sin límite de rango, desde hoy: `por_confirmar` son las citas pendientes
 *       ordenadas por `confirmar_antes_de` (las que se cancelan solas primero) y `fuera_de_disponibilidad`
 *       las pendientes o confirmadas futuras que ya no caben en la disponibilidad de su empleado, por fecha
 *       y hora, con `motivo_fuera`. Una cita pendiente fuera de disponibilidad está en las dos listas.
 *       Filtros: sucursal, empleado y `solo_mias`, como en la agenda.
 *     tags: [Citas]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *       - { in: query, name: id_sucursal, schema: { type: integer } }
 *       - { in: query, name: id_empleado, schema: { type: integer } }
 *       - { in: query, name: solo_mias, schema: { type: string, enum: ["true", "false"] } }
 *     responses:
 *       200:
 *         description: Citas por atender
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
 *                     por_confirmar: { type: array, items: { $ref: '#/components/schemas/CitaPanel' } }
 *                     fuera_de_disponibilidad: { type: array, items: { $ref: '#/components/schemas/CitaPanel' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/negocios/:id_negocio/citas/atencion",
  authMiddleware,
  validate({ params: idNegocioParams, query: atencionQuery }),
  authorize("citas", "ver"),
  controller.getAtencion
);

router.get(
  "/negocios/:id_negocio/citas",
  authMiddleware,
  validate({ params: idNegocioParams, query: agendaQuery }),
  authorize("citas", "ver"),
  controller.getAgenda
);

router.post(
  "/negocios/:id_negocio/citas",
  authMiddleware,
  validate({ params: idNegocioParams, body: createCitaPanelBody }),
  authorize("citas", "crear"),
  controller.createCitaPanel
);

export default router;
