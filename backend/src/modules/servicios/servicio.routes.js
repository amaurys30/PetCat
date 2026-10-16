import express from "express";
import * as controller from "./servicio.controller.js";
import { createServicioBody, idServicioParams, listServiciosQuery, updateServicioBody } from "./servicio.schemas.js";
import { idNegocioParams } from "../negocios/negocio.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { authorize, authorizeAny } from "../../shared/middlewares/authorize.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     CategoriaServicio:
 *       type: object
 *       properties:
 *         id_categoria: { type: integer, example: 1 }
 *         nombre: { type: string, example: Consulta y diagnóstico }
 *         descripcion: { type: string, nullable: true }
 *         icono: { type: string, nullable: true, example: stethoscope }
 *         orden_display: { type: integer }
 *     ServicioInput:
 *       type: object
 *       additionalProperties: false
 *       description: >
 *         Campos opcionales con `null` se vacían. Reglas entre campos (422): `precio_maximo >= precio_base`,
 *         `peso_min_kg <= peso_max_kg`, con `en_oferta: true` se exige `precio_oferta < precio_base`, y
 *         `fecha_fin_oferta >= fecha_inicio_oferta`. Al editar se comprueban con los valores actuales.
 *         Al crear una oferta o cambiar alguno de sus campos (`en_oferta`, `precio_oferta`, `fecha_inicio_oferta`,
 *         `fecha_fin_oferta`, con un valor distinto del guardado), las dos fechas son obligatorias y
 *         `fecha_fin_oferta` no puede ser anterior a hoy (hora de Bogotá). Una oferta ya vencida que no se toca
 *         no impide editar el resto del servicio.
 *       properties:
 *         id_categoria: { type: integer, description: Categoría activa (GET /categorias-servicio) }
 *         nombre: { type: string, minLength: 2, maxLength: 150, description: Único entre los servicios activos del negocio }
 *         descripcion: { type: string, maxLength: 2000, nullable: true }
 *         indicaciones_previas:
 *           type: string
 *           maxLength: 500
 *           nullable: true
 *           example: Ayuno de 8 horas (agua sí). Trae el carnet de vacunas.
 *           description: >
 *             Preparación antes de la cita. Se muestra en el servicio de la app y en el recordatorio del día
 *             anterior (en la app y el correo; no en la push). null = sin indicaciones.
 *         precio_base: { type: number, minimum: 0, example: 60000 }
 *         precio_maximo: { type: number, minimum: 0, nullable: true, description: Para precios variables }
 *         tipo_precio: { type: string, enum: [fijo, por_hora, por_dia, variable], default: fijo }
 *         duracion_minutos: { type: integer, minimum: 5, maximum: 1440, multipleOf: 5, default: 30 }
 *         margen_minutos:
 *           type: integer
 *           minimum: 0
 *           maximum: 240
 *           multipleOf: 5
 *           default: 0
 *           description: Tiempo que ocupa la agenda del empleado después de la cita (no cambia la hora de fin de la cita)
 *         tipo_mascota:
 *           type: array
 *           items: { type: string, enum: [perro, gato, conejo, ave, reptil, roedor, todos] }
 *           default: [todos]
 *           description: "`todos` no se combina con otras especies"
 *         peso_min_kg: { type: number, nullable: true }
 *         peso_max_kg: { type: number, nullable: true }
 *         requiere_cita: { type: boolean, default: true }
 *         max_citas_dia: { type: integer, minimum: 1, maximum: 255, nullable: true, description: Por sucursal y día; null = sin límite }
 *         dias_disponible:
 *           type: array
 *           nullable: true
 *           items: { type: string, enum: [lunes, martes, miercoles, jueves, viernes, sabado, domingo] }
 *           description: null = todos los días
 *         visible_app: { type: boolean, default: true }
 *         en_oferta: { type: boolean, default: false }
 *         precio_oferta: { type: number, nullable: true }
 *         fecha_inicio_oferta: { type: string, format: date, nullable: true }
 *         fecha_fin_oferta: { type: string, format: date, nullable: true }
 *         etiquetas: { type: array, maxItems: 10, nullable: true, items: { type: string, maxLength: 40 } }
 *         empleados:
 *           type: array
 *           items: { type: integer }
 *           description: >
 *             Empleados activos del negocio que atienden el servicio (422 si alguno no lo es). Al editar
 *             reemplaza el conjunto de empleados activos asignados; `[]` lo deja sin empleados. Las
 *             asignaciones de empleados inactivos se conservan.
 *     EmpleadoAsignado:
 *       type: object
 *       properties:
 *         id_empleado: { type: integer }
 *         nombre: { type: string }
 *         apellido: { type: string }
 *     Servicio:
 *       type: object
 *       description: Servicio en el panel del negocio.
 *       properties:
 *         id_servicio: { type: integer, example: 5 }
 *         id_negocio: { type: integer }
 *         categoria:
 *           type: object
 *           properties:
 *             id_categoria: { type: integer }
 *             nombre: { type: string }
 *         nombre: { type: string }
 *         descripcion: { type: string, nullable: true }
 *         indicaciones_previas: { type: string, nullable: true }
 *         precio_base: { type: number }
 *         precio_maximo: { type: number, nullable: true }
 *         tipo_precio: { type: string }
 *         precio_actual: { type: number, description: Precio de oferta si está vigente hoy; si no, precio_base }
 *         oferta_vigente: { type: boolean }
 *         duracion_minutos: { type: integer }
 *         margen_minutos: { type: integer }
 *         tipo_mascota: { type: array, items: { type: string } }
 *         peso_min_kg: { type: number, nullable: true }
 *         peso_max_kg: { type: number, nullable: true }
 *         requiere_cita: { type: boolean }
 *         max_citas_dia: { type: integer, nullable: true }
 *         dias_disponible: { type: array, nullable: true, items: { type: string } }
 *         visible_app: { type: boolean }
 *         en_oferta: { type: boolean }
 *         precio_oferta: { type: number, nullable: true }
 *         fecha_inicio_oferta: { type: string, format: date, nullable: true }
 *         fecha_fin_oferta: { type: string, format: date, nullable: true }
 *         etiquetas: { type: array, nullable: true, items: { type: string } }
 *         activo: { type: boolean }
 *         empleados: { type: array, items: { $ref: '#/components/schemas/EmpleadoAsignado' }, description: Solo empleados activos }
 *         sin_empleados: { type: boolean, description: Ningún empleado activo asignado (no se puede reservar si requiere cita) }
 *         reservable: { type: boolean }
 *         fecha_creacion: { type: string }
 *         fecha_actualizacion: { type: string }
 *     ServicioRespuesta:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string }
 *         data: { $ref: '#/components/schemas/Servicio' }
 */

/**
 * @swagger
 * /categorias-servicio:
 *   get:
 *     summary: Categorías de servicio
 *     description: Público. Categorías activas en orden de presentación.
 *     tags: [Servicios]
 *     security: []
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
 *                 data: { type: array, items: { $ref: '#/components/schemas/CategoriaServicio' } }
 */
router.get("/categorias-servicio", controller.getCategorias);

/**
 * @swagger
 * /negocios/{id_negocio}/servicios:
 *   parameters:
 *     - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *   get:
 *     summary: Servicios del negocio (panel)
 *     description: >
 *       Requiere `servicios.ver` o `citas.crear` (para elegir el servicio al agendar). Incluye servicios inactivos y ocultos (activos primero). Cada
 *       servicio trae sus empleados activos asignados y `sin_empleados`.
 *     tags: [Servicios]
 *     parameters:
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - { in: query, name: activo, schema: { type: string, enum: ["true", "false"] }, description: Sin filtro devuelve todos }
 *       - { in: query, name: visible_app, schema: { type: string, enum: ["true", "false"] } }
 *       - { in: query, name: id_categoria, schema: { type: integer } }
 *       - { in: query, name: q, schema: { type: string, maxLength: 100 }, description: Busca en nombre y descripción }
 *     responses:
 *       200:
 *         description: Página de servicios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Servicio' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   post:
 *     summary: Crear un servicio
 *     description: Requiere `servicios.crear`. Crea el servicio y sus empleados asignados en una transacción.
 *     tags: [Servicios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/ServicioInput'
 *               - required: [id_categoria, nombre, precio_base]
 *     responses:
 *       201:
 *         description: Servicio creado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ServicioRespuesta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Ya existe un servicio activo con ese nombre en el negocio
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/negocios/:id_negocio/servicios",
  authMiddleware,
  validate({ params: idNegocioParams, query: listServiciosQuery }),
  // Agendar desde el panel (B5) necesita elegir el servicio, también los ocultos en la app.
  authorizeAny([
    ["servicios", "ver"],
    ["citas", "crear"],
  ]),
  controller.getServicios
);

router.post(
  "/negocios/:id_negocio/servicios",
  authMiddleware,
  validate({ params: idNegocioParams, body: createServicioBody }),
  authorize("servicios", "crear"),
  controller.createServicio
);

/**
 * @swagger
 * /servicios/{id_servicio}:
 *   parameters:
 *     - { in: path, name: id_servicio, required: true, schema: { type: integer } }
 *   get:
 *     summary: Detalle público de un servicio
 *     description: >
 *       Público (sin token), para la app. 404 si no existe, está eliminado u oculto (`visible_app`),
 *       o su negocio está inactivo. Incluye los empleados activos que lo atienden.
 *     tags: [Servicios]
 *     security: []
 *     responses:
 *       200:
 *         description: Servicio
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/ServicioPublico'
 *                     - type: object
 *                       properties:
 *                         empleados:
 *                           type: array
 *                           items:
 *                             allOf:
 *                               - $ref: '#/components/schemas/EmpleadoAsignado'
 *                               - type: object
 *                                 properties:
 *                                   especialidad: { type: string, nullable: true }
 *                                   foto_url: { type: string, nullable: true }
 *                                   foto_miniatura_url: { type: string, nullable: true }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   patch:
 *     summary: Editar un servicio
 *     description: >
 *       Requiere `servicios.editar`. Al menos un campo. Si trae `empleados`, reemplaza los empleados
 *       activos asignados. Cambiar la duración o el margen no modifica las citas ya creadas. Se puede
 *       editar un servicio eliminado (el nombre se comprueba al reactivarlo).
 *     tags: [Servicios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/ServicioInput'
 *               - minProperties: 1
 *     responses:
 *       200:
 *         description: Servicio actualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ServicioRespuesta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Ya existe un servicio activo con ese nombre en el negocio
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   delete:
 *     summary: Eliminar un servicio
 *     description: >
 *       Requiere `servicios.eliminar`. Borrado lógico; se conservan los empleados asignados para
 *       reactivarlo. 404 si ya está eliminado.
 *     tags: [Servicios]
 *     responses:
 *       200:
 *         description: Servicio eliminado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Servicio eliminado }
 *                 data: { nullable: true, example: null }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: >
 *           El servicio tiene citas futuras pendientes o confirmadas. `data.citas_afectadas` las trae
 *           (mismo formato que `citas_afectadas` de horarios y disponibilidad) para cancelarlas o reprogramarlas.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 message: { type: string, example: "El servicio tiene 2 citas pendientes o confirmadas: cancélalas o reprográmalas antes de eliminarlo" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     citas_afectadas: { $ref: '#/components/schemas/CitasAfectadas' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get("/servicios/:id_servicio", validate({ params: idServicioParams }), controller.getServicioPublico);

router.patch(
  "/servicios/:id_servicio",
  authMiddleware,
  validate({ params: idServicioParams, body: updateServicioBody }),
  authorize("servicios", "editar"),
  controller.updateServicio
);

router.delete(
  "/servicios/:id_servicio",
  authMiddleware,
  validate({ params: idServicioParams }),
  authorize("servicios", "eliminar"),
  controller.deleteServicio
);

/**
 * @swagger
 * /servicios/{id_servicio}/gestion:
 *   get:
 *     summary: Detalle de un servicio (panel)
 *     description: >
 *       Requiere `servicios.ver`. El mismo formato del listado del panel, también para servicios
 *       eliminados u ocultos en la app (el detalle público responde 404 en esos casos).
 *     tags: [Servicios]
 *     parameters:
 *       - { in: path, name: id_servicio, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Servicio
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ServicioRespuesta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/servicios/:id_servicio/gestion",
  authMiddleware,
  validate({ params: idServicioParams }),
  authorize("servicios", "ver"),
  controller.getServicioGestion
);

/**
 * @swagger
 * /servicios/{id_servicio}/reactivar:
 *   patch:
 *     summary: Reactivar un servicio eliminado
 *     description: >
 *       Requiere `servicios.editar`. 409 si ya está activo o si otro servicio activo del negocio
 *       tiene el mismo nombre (cámbialo primero con PATCH).
 *     tags: [Servicios]
 *     parameters:
 *       - { in: path, name: id_servicio, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Servicio reactivado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ServicioRespuesta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Ya está activo o su nombre está en uso
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.patch(
  "/servicios/:id_servicio/reactivar",
  authMiddleware,
  validate({ params: idServicioParams }),
  authorize("servicios", "editar"),
  controller.reactivarServicio
);

export default router;
