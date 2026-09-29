import express from "express";
import * as controller from "./vacuna.controller.js";
import * as vacunaRepo from "./vacuna.repository.js";
import { createVacunaDuenoBody, createVacunaNegocioBody, idVacunaParams, updateVacunaBody } from "./vacuna.schemas.js";
import { idMascotaParams } from "../mascotas/mascota.schemas.js";
import { idNegocioParams } from "../negocios/negocio.schemas.js";
import { mascotaDeNegocioParams } from "../historial/historial.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { authorize, authorizeDuenoO } from "../../shared/middlewares/authorize.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";
import { uploadLimiter } from "../../shared/middlewares/rateLimit.js";
import { recibirArchivos } from "../../shared/utils/uploads.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     VacunaInput:
 *       type: object
 *       additionalProperties: false
 *       description: >
 *         Campos opcionales con `null` se vacían. `fecha_proxima` debe ser posterior a `fecha_aplicacion`.
 *         El comprobante no va aquí: se sube con `PUT /vacunas/{id_vacuna}/comprobante` (`comprobante_url` da 422).
 *       properties:
 *         nombre_vacuna: { type: string, maxLength: 150, example: Antirrábica }
 *         enfermedad_objetivo: { type: string, maxLength: 150, nullable: true }
 *         laboratorio: { type: string, maxLength: 100, nullable: true }
 *         lote: { type: string, maxLength: 60, nullable: true }
 *         dosis: { type: string, maxLength: 60, nullable: true, example: Refuerzo anual }
 *         via_administracion: { type: string, maxLength: 60, nullable: true }
 *         sitio_aplicacion: { type: string, maxLength: 60, nullable: true }
 *         fecha_aplicacion: { type: string, format: date, description: No puede ser futura }
 *         fecha_proxima: { type: string, format: date, nullable: true, description: Próxima dosis o refuerzo }
 *         notas: { type: string, maxLength: 300, nullable: true }
 *     Vacuna:
 *       type: object
 *       properties:
 *         id_vacuna: { type: integer }
 *         id_mascota: { type: integer }
 *         nombre_vacuna: { type: string }
 *         enfermedad_objetivo: { type: string, nullable: true }
 *         laboratorio: { type: string, nullable: true }
 *         lote: { type: string, nullable: true }
 *         dosis: { type: string, nullable: true }
 *         via_administracion: { type: string, nullable: true }
 *         sitio_aplicacion: { type: string, nullable: true }
 *         fecha_aplicacion: { type: string, format: date }
 *         fecha_proxima: { type: string, format: date, nullable: true }
 *         estado:
 *           type: string
 *           enum: [al_dia, proximo, vencido, no_aplica]
 *           description: >
 *             Calculado sobre todas las vacunas de la mascota: las dosis anteriores de la misma vacuna son
 *             no_aplica; la vigente es vencido (fecha_proxima pasada), proximo (dentro de 30 días) o al_dia.
 *         registrada_por: { type: string, enum: [dueno, negocio], description: El dueño (externa) o un profesional }
 *         tiene_comprobante: { type: boolean }
 *         comprobante:
 *           allOf:
 *             - $ref: '#/components/schemas/ArchivoPrivado'
 *           nullable: true
 *           description: Foto o PDF del carnet, con URL firmada que vence (null si no tiene)
 *         notas: { type: string, nullable: true }
 *         negocio: { type: object, nullable: true, properties: { id_negocio: { type: integer }, nombre: { type: string } } }
 *         empleado:
 *           type: object
 *           nullable: true
 *           properties: { id_empleado: { type: integer }, nombre: { type: string }, apellido: { type: string } }
 *         id_historial_medico: { type: integer, nullable: true }
 *         fecha_creacion: { type: string }
 *     VacunaRespuesta:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Vacuna registrada }
 *         data: { $ref: '#/components/schemas/Vacuna' }
 *     VacunasLista:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: OK }
 *         data: { type: array, items: { $ref: '#/components/schemas/Vacuna' } }
 */

/**
 * @swagger
 * /mascotas/{id_mascota}/vacunas:
 *   get:
 *     summary: Carnet de vacunas de una mascota propia (app)
 *     description: Todas sus vacunas (de negocios y registradas por el dueño), de la más reciente a la más antigua.
 *     tags: [Vacunas]
 *     parameters:
 *       - { in: path, name: id_mascota, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Vacunas
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/VacunasLista' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/MascotaAjena' }
 *       404: { $ref: '#/components/responses/MascotaNoEncontrada' }
 *   post:
 *     summary: Registrar una vacuna externa (app)
 *     description: >
 *       El dueño registra una vacuna aplicada fuera de PetCat. Queda con `registrada_por: dueno` para que el
 *       veterinario la distinga. El comprobante (foto del carnet) se sube después con
 *       `PUT /vacunas/{id_vacuna}/comprobante`. Mascota fallecida: 409.
 *     tags: [Vacunas]
 *     parameters:
 *       - { in: path, name: id_mascota, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/VacunaInput'
 *               - required: [nombre_vacuna, fecha_aplicacion]
 *     responses:
 *       201:
 *         description: Vacuna registrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/VacunaRespuesta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/MascotaAjena' }
 *       404: { $ref: '#/components/responses/MascotaNoEncontrada' }
 *       409:
 *         description: La mascota está registrada como fallecida
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get("/mascotas/:id_mascota/vacunas", authMiddleware, validate({ params: idMascotaParams }), controller.getVacunasDueno);
router.post(
  "/mascotas/:id_mascota/vacunas",
  authMiddleware,
  validate({ params: idMascotaParams, body: createVacunaDuenoBody }),
  controller.crearVacunaDueno
);

/**
 * @swagger
 * /negocios/{id_negocio}/mascotas/{id_mascota}/vacunas:
 *   get:
 *     summary: Carnet de vacunas de una mascota (panel)
 *     description: >
 *       Requiere `vacunas.ver` y una cita válida con la mascota. Las vacunas son siempre visibles (también
 *       con `compartir_historial` desactivado), para evitar revacunaciones innecesarias.
 *     tags: [Vacunas]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *       - { in: path, name: id_mascota, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Vacunas
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/VacunasLista' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/negocios/:id_negocio/mascotas/:id_mascota/vacunas",
  authMiddleware,
  validate({ params: mascotaDeNegocioParams }),
  authorize("vacunas", "ver"),
  controller.getVacunasNegocio
);

/**
 * @swagger
 * /negocios/{id_negocio}/vacunas:
 *   post:
 *     summary: Registrar una vacuna aplicada por el negocio (panel)
 *     description: >
 *       Requiere `vacunas.crear` y una cita válida con la mascota. `id_empleado` por defecto es el perfil de
 *       empleado de quien registra; `id_historial_medico` (opcional) debe ser un registro de este negocio
 *       para esa mascota. Recalcula el estado de todas las vacunas de la mascota.
 *     tags: [Vacunas]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/VacunaInput'
 *               - type: object
 *                 required: [id_mascota, nombre_vacuna, fecha_aplicacion]
 *                 properties:
 *                   id_mascota: { type: integer }
 *                   id_empleado: { type: integer, nullable: true }
 *                   id_historial_medico: { type: integer, nullable: true }
 *     responses:
 *       201:
 *         description: Vacuna registrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/VacunaRespuesta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: La mascota está registrada como fallecida
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  "/negocios/:id_negocio/vacunas",
  authMiddleware,
  validate({ params: idNegocioParams, body: createVacunaNegocioBody }),
  authorize("vacunas", "crear"),
  controller.crearVacunaNegocio
);

/**
 * @swagger
 * /vacunas/{id_vacuna}:
 *   patch:
 *     summary: Editar una vacuna (dueño o negocio)
 *     description: >
 *       La vacuna que registró el dueño solo la edita el dueño; la que registró un negocio, solo ese negocio
 *       (`vacunas.editar`). El dueño no puede enviar `id_empleado` ni `id_historial_medico`. Recalcula el estado
 *       de todas las vacunas de la mascota. Si cambia `fecha_proxima`, los recordatorios al dueño (7 días antes,
 *       el día y 7 días después) vuelven a empezar con la fecha nueva.
 *     tags: [Vacunas]
 *     parameters:
 *       - { in: path, name: id_vacuna, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/VacunaInput'
 *               - type: object
 *                 minProperties: 1
 *                 properties:
 *                   id_empleado: { type: integer, nullable: true, description: Solo el negocio }
 *                   id_historial_medico: { type: integer, nullable: true, description: Solo el negocio }
 *     responses:
 *       200:
 *         description: Vacuna actualizada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/VacunaRespuesta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// Dueño de la mascota de la vacuna, o el negocio de la vacuna con vacunas.editar.
const editarVacuna = authorizeDuenoO("vacunas", "editar", {
  esDueno: async (req) => (await vacunaRepo.findMascotaDeVacuna(req.params.id_vacuna))?.id_usuario === req.user.id_usuario,
});

router.patch(
  "/vacunas/:id_vacuna",
  authMiddleware,
  validate({ params: idVacunaParams, body: updateVacunaBody }),
  editarVacuna,
  controller.actualizarVacuna
);

/**
 * @swagger
 * /vacunas/{id_vacuna}/comprobante:
 *   put:
 *     summary: Subir o reemplazar el comprobante de una vacuna (dueño o negocio)
 *     description: >
 *       Mismas reglas que editar la vacuna: la registrada por el dueño la edita el dueño; la de un negocio,
 *       ese negocio (`vacunas.editar`). multipart/form-data con el archivo en `comprobante` (foto o PDF).
 *       Se guarda **privado**: la vacuna trae `comprobante` con una URL firmada que vence. El anterior se borra.
 *     tags: [Vacunas]
 *     parameters:
 *       - { in: path, name: id_vacuna, required: true, schema: { type: integer } }
 *     requestBody: { $ref: '#/components/requestBodies/Comprobante' }
 *     responses:
 *       200:
 *         description: Comprobante guardado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/VacunaRespuesta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ArchivoInvalido' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/AlmacenamientoNoDisponible' }
 *   delete:
 *     summary: Eliminar el comprobante de una vacuna (dueño o negocio)
 *     description: Mismas reglas que editar la vacuna. 404 si no tiene comprobante.
 *     tags: [Vacunas]
 *     parameters:
 *       - { in: path, name: id_vacuna, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Comprobante eliminado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/VacunaRespuesta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.put(
  "/vacunas/:id_vacuna/comprobante",
  authMiddleware,
  validate({ params: idVacunaParams }),
  editarVacuna,
  uploadLimiter,
  recibirArchivos("vacuna_comprobante"),
  controller.subirComprobante
);
router.delete(
  "/vacunas/:id_vacuna/comprobante",
  authMiddleware,
  validate({ params: idVacunaParams }),
  editarVacuna,
  controller.eliminarComprobante
);

export default router;
