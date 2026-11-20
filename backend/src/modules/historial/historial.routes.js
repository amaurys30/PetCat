import express from "express";
import * as controller from "./historial.controller.js";
import {
  archivoDeHistorialParams,
  createHistorialBody,
  idHistorialParams,
  listHistorialQuery,
  mascotaDeNegocioParams,
  updateHistorialBody,
} from "./historial.schemas.js";
import { idMascotaParams } from "../mascotas/mascota.schemas.js";
import { idNegocioParams } from "../negocios/negocio.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { authorize } from "../../shared/middlewares/authorize.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";
import { uploadLimiter } from "../../shared/middlewares/rateLimit.js";
import { recibirArchivos } from "../../shared/utils/uploads.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     HistorialInput:
 *       type: object
 *       additionalProperties: false
 *       description: >
 *         Campos opcionales con `null` se vacían. `proximo_control` no puede ser anterior a `fecha`.
 *         Los archivos no van aquí (`archivos` da 422): se suben con `POST /historial/{id_historial}/archivos`.
 *       properties:
 *         tipo: { type: string, enum: [consulta_general, control, cirugia, vacunacion, examen_laboratorio, radiografia, ecografia, hospitalizacion, urgencia, desparasitacion, otro] }
 *         fecha: { type: string, format: date, description: Por defecto hoy; no puede ser futura }
 *         motivo_consulta: { type: string, maxLength: 2000, nullable: true }
 *         diagnostico: { type: string, maxLength: 2000, nullable: true }
 *         tratamiento: { type: string, maxLength: 2000, nullable: true }
 *         medicamentos_prescritos: { type: string, maxLength: 2000, nullable: true }
 *         indicaciones: { type: string, maxLength: 2000, nullable: true }
 *         proximo_control: { type: string, format: date, nullable: true }
 *         peso_registro: { type: number, nullable: true, description: "En kg; si es el registro más reciente, actualiza el peso de la mascota" }
 *         temperatura: { type: number, minimum: 25, maximum: 45, nullable: true }
 *         frecuencia_cardiaca: { type: integer, nullable: true }
 *         frecuencia_respiratoria: { type: integer, nullable: true }
 *         notas_internas: { type: string, maxLength: 2000, nullable: true, description: Solo las ve el negocio que creó el registro }
 *         id_empleado:
 *           type: integer
 *           nullable: true
 *           description: >
 *             Quien atendió; por defecto el perfil de empleado de quien registra. Elegir a otro profesional
 *             (o cambiarlo al editar) exige historial_medico.asignar_profesional (el propietario y el admin de
 *             plataforma siempre pueden); sin el permiso es siempre el perfil de quien registra, y otro da 403.
 *     RegistroHistorial:
 *       type: object
 *       properties:
 *         id_historial: { type: integer }
 *         id_mascota: { type: integer }
 *         id_cita: { type: integer, nullable: true }
 *         fecha: { type: string, format: date }
 *         tipo: { type: string }
 *         motivo_consulta: { type: string, nullable: true }
 *         diagnostico: { type: string, nullable: true }
 *         tratamiento: { type: string, nullable: true }
 *         medicamentos_prescritos: { type: string, nullable: true }
 *         indicaciones: { type: string, nullable: true }
 *         proximo_control: { type: string, format: date, nullable: true }
 *         peso_registro: { type: number, nullable: true }
 *         temperatura: { type: number, nullable: true }
 *         frecuencia_cardiaca: { type: integer, nullable: true }
 *         frecuencia_respiratoria: { type: integer, nullable: true }
 *         archivos:
 *           type: array
 *           description: Imágenes y PDF privados, con URL firmada que vence (hasta 10 por registro)
 *           items: { $ref: '#/components/schemas/ArchivoPrivado' }
 *         negocio: { type: object, nullable: true, properties: { id_negocio: { type: integer }, nombre: { type: string } } }
 *         empleado:
 *           type: object
 *           nullable: true
 *           properties: { id_empleado: { type: integer }, nombre: { type: string }, apellido: { type: string } }
 *         es_propio: { type: boolean, x-opcional: true, description: Solo en el panel; lo creó el negocio que consulta }
 *         notas_internas: { type: string, nullable: true, x-opcional: true, description: Solo en los registros del negocio que consulta }
 *         registrado_por:
 *           type: object
 *           nullable: true
 *           x-opcional: true
 *           description: >
 *             Solo en los registros del negocio que consulta. Quién creó el registro, que puede no ser el
 *             profesional que atendió (empleado). null en los registros anteriores a la migración 026 o si la
 *             cuenta ya no existe.
 *           properties: { id_usuario: { type: integer }, nombre: { type: string }, apellido: { type: string } }
 *         fecha_creacion: { type: string }
 *         edicion:
 *           type: object
 *           nullable: true
 *           description: >
 *             Última edición (los registros no se borran: cada edición queda con quién, cuándo, los campos que
 *             cambiaron y sus valores anteriores). null si nunca se editó. Los archivos tienen su propio rastro.
 *           properties:
 *             fecha: { type: string, example: "2026-10-17 10:15:00" }
 *             usuario:
 *               type: object
 *               nullable: true
 *               description: null si la cuenta de quien editó ya no existe
 *               properties: { id_usuario: { type: integer }, nombre: { type: string }, apellido: { type: string } }
 *         ediciones: { type: integer, description: Cuántas veces se editó }
 *     HistorialPagina:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: OK }
 *         data: { type: array, items: { $ref: '#/components/schemas/RegistroHistorial' } }
 *         meta: { $ref: '#/components/schemas/PaginationMeta' }
 *   parameters:
 *     historialTipo:
 *       in: query
 *       name: tipo
 *       description: Uno o varios tipos separados por comas (consulta_general,control)
 *       schema: { type: string, example: "consulta_general,control" }
 *     historialDesde: { in: query, name: desde, schema: { type: string, format: date } }
 *     historialHasta: { in: query, name: hasta, schema: { type: string, format: date } }
 */

/**
 * @swagger
 * /mascotas/{id_mascota}/historial:
 *   get:
 *     summary: Historial médico de una mascota propia (app)
 *     description: De todos los negocios, del más reciente al más antiguo, sin notas internas. Paginado.
 *     tags: [Historial médico]
 *     parameters:
 *       - { in: path, name: id_mascota, required: true, schema: { type: integer } }
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - $ref: '#/components/parameters/historialTipo'
 *       - $ref: '#/components/parameters/historialDesde'
 *       - $ref: '#/components/parameters/historialHasta'
 *     responses:
 *       200:
 *         description: Página del historial
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/HistorialPagina' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/MascotaAjena' }
 *       404: { $ref: '#/components/responses/MascotaNoEncontrada' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/mascotas/:id_mascota/historial",
  authMiddleware,
  validate({ params: idMascotaParams, query: listHistorialQuery }),
  controller.getHistorialDueno
);

/**
 * @swagger
 * /negocios/{id_negocio}/mascotas/{id_mascota}/historial:
 *   get:
 *     summary: Historial médico de una mascota (panel)
 *     description: >
 *       Requiere `historial_medico.ver` y que la mascota tenga una cita con el negocio que no esté
 *       cancelada ni reprogramada (403 si no). Si el dueño desactivó `compartir_historial`, solo se ven
 *       los registros de este negocio. Las notas internas solo aparecen en los registros propios.
 *     tags: [Historial médico]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *       - { in: path, name: id_mascota, required: true, schema: { type: integer } }
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - $ref: '#/components/parameters/historialTipo'
 *       - $ref: '#/components/parameters/historialDesde'
 *       - $ref: '#/components/parameters/historialHasta'
 *     responses:
 *       200:
 *         description: Página del historial
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/HistorialPagina' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/negocios/:id_negocio/mascotas/:id_mascota/historial",
  authMiddleware,
  validate({ params: mascotaDeNegocioParams, query: listHistorialQuery }),
  authorize("historial_medico", "ver"),
  controller.getHistorialNegocio
);

/**
 * @swagger
 * /negocios/{id_negocio}/historial:
 *   post:
 *     summary: Crear un registro del historial médico (panel)
 *     description: >
 *       Requiere `historial_medico.crear`. La mascota debe tener una cita válida con el negocio.
 *       `id_cita` (opcional) debe ser del negocio, de esa mascota y no estar cancelada ni reprogramada.
 *     tags: [Historial médico]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/HistorialInput'
 *               - type: object
 *                 required: [id_mascota, tipo]
 *                 properties:
 *                   id_mascota: { type: integer }
 *                   id_cita: { type: integer }
 *     responses:
 *       201:
 *         description: Registro creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Registro de historial creado }
 *                 data: { $ref: '#/components/schemas/RegistroHistorial' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  "/negocios/:id_negocio/historial",
  authMiddleware,
  validate({ params: idNegocioParams, body: createHistorialBody }),
  authorize("historial_medico", "crear"),
  controller.crearRegistro
);

/**
 * @swagger
 * /historial/{id_historial}:
 *   patch:
 *     summary: Editar un registro del historial médico (panel)
 *     description: >
 *       Requiere `historial_medico.editar` en el negocio que creó el registro (otro negocio: 403). Sin
 *       límite de tiempo. Al menos un campo; la mascota, la cita y el negocio no cambian. Si algo cambia, queda
 *       la edición con quién, cuándo, los campos y sus valores anteriores (`edicion` y `ediciones` en la respuesta);
 *       si los valores son los mismos, no hay edición.
 *     tags: [Historial médico]
 *     parameters:
 *       - { in: path, name: id_historial, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/HistorialInput'
 *               - minProperties: 1
 *     responses:
 *       200:
 *         description: Registro actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Registro actualizado }
 *                 data: { $ref: '#/components/schemas/RegistroHistorial' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.patch(
  "/historial/:id_historial",
  authMiddleware,
  validate({ params: idHistorialParams, body: updateHistorialBody }),
  authorize("historial_medico", "editar"),
  controller.actualizarRegistro
);

/**
 * @swagger
 * /historial/{id_historial}/archivos:
 *   post:
 *     summary: Agregar archivos a un registro del historial (panel)
 *     description: >
 *       Requiere `historial_medico.editar` en el negocio que creó el registro (con las mismas reglas que
 *       editarlo). multipart/form-data con hasta 5 archivos en `archivos` (imágenes o PDF: radiografías,
 *       exámenes, fórmulas); 10 por registro en total (422 si se supera). Se guardan **privados**: el
 *       registro los devuelve con URLs firmadas que vencen, solo a quien puede verlo.
 *     tags: [Historial médico]
 *     parameters:
 *       - { in: path, name: id_historial, required: true, schema: { type: integer } }
 *     requestBody: { $ref: '#/components/requestBodies/ArchivosHistorial' }
 *     responses:
 *       201:
 *         description: Archivos agregados; responde el registro con todos sus archivos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Archivos agregados }
 *                 data: { $ref: '#/components/schemas/RegistroHistorial' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ArchivoInvalido' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/AlmacenamientoNoDisponible' }
 * /historial/{id_historial}/archivos/{id_archivo}:
 *   delete:
 *     summary: Eliminar un archivo de un registro del historial (panel)
 *     description: >
 *       Requiere `historial_medico.editar` en el negocio que creó el registro. 404 si el archivo no es de
 *       ese registro. El archivo se borra de Cloudinary; queda constancia de quién y cuándo lo eliminó.
 *     tags: [Historial médico]
 *     parameters:
 *       - { in: path, name: id_historial, required: true, schema: { type: integer } }
 *       - { in: path, name: id_archivo, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Archivo eliminado; responde el registro
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Archivo eliminado }
 *                 data: { $ref: '#/components/schemas/RegistroHistorial' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  "/historial/:id_historial/archivos",
  authMiddleware,
  validate({ params: idHistorialParams }),
  authorize("historial_medico", "editar"),
  uploadLimiter,
  recibirArchivos("historial_archivo"),
  controller.agregarArchivos
);
router.delete(
  "/historial/:id_historial/archivos/:id_archivo",
  authMiddleware,
  validate({ params: archivoDeHistorialParams }),
  authorize("historial_medico", "editar"),
  controller.eliminarArchivo
);

export default router;
