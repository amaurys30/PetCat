import express from "express";
import * as controller from "./mascota.controller.js";
import { createMascotaBody, idMascotaParams, updateMascotaBody } from "./mascota.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     MascotaInput:
 *       type: object
 *       additionalProperties: false
 *       description: Campos opcionales con `null` se vacían. La foto se sube aparte (Fase 2).
 *       properties:
 *         nombre: { type: string, maxLength: 80, example: Max }
 *         especie: { type: string, enum: [perro, gato, conejo, ave, reptil, roedor, pez, otro] }
 *         sexo: { type: string, enum: [macho, hembra, desconocido], default: desconocido }
 *         raza: { type: string, maxLength: 100, nullable: true, example: Labrador }
 *         color: { type: string, maxLength: 100, nullable: true }
 *         fecha_nacimiento: { type: string, format: date, nullable: true, description: No puede ser futura }
 *         peso: { type: number, exclusiveMinimum: 0, maximum: 9999.99, nullable: true, description: En kilogramos }
 *         microchip: { type: string, maxLength: 50, nullable: true }
 *         numero_registro: { type: string, maxLength: 60, nullable: true }
 *         esterilizado: { type: boolean, default: false }
 *         tiene_alergias: { type: boolean, default: false }
 *         compartir_historial:
 *           type: boolean
 *           default: true
 *           description: >
 *             Si es false, cada negocio ve solo el historial clínico que él creó. Las vacunas, las
 *             alergias y las condiciones médicas siguen visibles para los negocios con cita.
 *         alergias_detalle: { type: string, maxLength: 2000, nullable: true }
 *         condiciones_medicas: { type: string, maxLength: 2000, nullable: true }
 *         tipo_sangre: { type: string, maxLength: 10, nullable: true }
 *     Mascota:
 *       type: object
 *       properties:
 *         id_mascota: { type: integer, example: 7 }
 *         id_usuario: { type: integer, description: Dueño }
 *         nombre: { type: string }
 *         especie: { type: string }
 *         raza: { type: string, nullable: true }
 *         color: { type: string, nullable: true }
 *         fecha_nacimiento: { type: string, format: date, nullable: true }
 *         edad_meses: { type: integer, nullable: true, description: Calculada con la fecha de nacimiento }
 *         sexo: { type: string, enum: [macho, hembra, desconocido] }
 *         peso: { type: number, nullable: true }
 *         microchip: { type: string, nullable: true }
 *         numero_registro: { type: string, nullable: true }
 *         esterilizado: { type: boolean }
 *         tiene_alergias: { type: boolean }
 *         compartir_historial: { type: boolean }
 *         alergias_detalle: { type: string, nullable: true }
 *         condiciones_medicas: { type: string, nullable: true }
 *         tipo_sangre: { type: string, nullable: true }
 *         foto_url: { type: string, nullable: true }
 *         fallecido: { type: boolean }
 *         fecha_fallecimiento: { type: string, format: date, nullable: true }
 *         fecha_registro: { type: string, example: "2026-09-26 10:00:00" }
 *         fecha_actualizacion: { type: string, example: "2026-09-26 10:00:00" }
 *     MascotaRespuesta:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string }
 *         data: { $ref: '#/components/schemas/Mascota' }
 *   responses:
 *     MascotaAjena:
 *       description: La mascota es de otro usuario
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ErrorResponse' }
 *           example: { success: false, message: No tienes acceso a esta mascota }
 *     MascotaNoEncontrada:
 *       description: No existe o se eliminó
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ErrorResponse' }
 *           example: { success: false, message: Mascota no encontrada }
 */

/**
 * @swagger
 * /mascotas:
 *   get:
 *     summary: Mis mascotas
 *     description: Mascotas del usuario autenticado sin las eliminadas; las fallecidas van al final.
 *     tags: [Mascotas]
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
 *                 data: { type: array, items: { $ref: '#/components/schemas/Mascota' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     summary: Registrar una mascota
 *     description: La mascota queda a nombre del usuario autenticado.
 *     tags: [Mascotas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/MascotaInput'
 *               - required: [nombre, especie]
 *     responses:
 *       201:
 *         description: Mascota registrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MascotaRespuesta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get("/mascotas", authMiddleware, controller.getMisMascotas);
router.post("/mascotas", authMiddleware, validate({ body: createMascotaBody }), controller.createMascota);

/**
 * @swagger
 * /mascotas/{id_mascota}:
 *   parameters:
 *     - { in: path, name: id_mascota, required: true, schema: { type: integer } }
 *   get:
 *     summary: Detalle de una mascota propia
 *     tags: [Mascotas]
 *     responses:
 *       200:
 *         description: Mascota
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MascotaRespuesta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/MascotaAjena' }
 *       404: { $ref: '#/components/responses/MascotaNoEncontrada' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   patch:
 *     summary: Editar una mascota propia
 *     description: >
 *       Al menos un campo. Para registrar el fallecimiento: `fallecido: true` y, opcional,
 *       `fecha_fallecimiento` (por defecto hoy; no anterior al nacimiento); da 409 si la mascota
 *       tiene citas futuras pendientes o confirmadas. `fallecido: false` borra la fecha.
 *     tags: [Mascotas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/MascotaInput'
 *               - type: object
 *                 minProperties: 1
 *                 properties:
 *                   fallecido: { type: boolean }
 *                   fecha_fallecimiento: { type: string, format: date, nullable: true }
 *     responses:
 *       200:
 *         description: Mascota actualizada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MascotaRespuesta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/MascotaAjena' }
 *       404: { $ref: '#/components/responses/MascotaNoEncontrada' }
 *       409:
 *         description: Registrar el fallecimiento con citas futuras pendientes o confirmadas
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   delete:
 *     summary: Eliminar una mascota propia
 *     description: Borrado lógico; se conservan su historial y sus citas. Después responde 404.
 *     tags: [Mascotas]
 *     responses:
 *       200:
 *         description: Mascota eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Mascota eliminada }
 *                 data: { nullable: true, example: null }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/MascotaAjena' }
 *       404: { $ref: '#/components/responses/MascotaNoEncontrada' }
 *       409:
 *         description: La mascota tiene citas futuras pendientes o confirmadas
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { success: false, message: "La mascota tiene citas pendientes o confirmadas: cancélalas antes de eliminarla" }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get("/mascotas/:id_mascota", authMiddleware, validate({ params: idMascotaParams }), controller.getMascota);
router.patch(
  "/mascotas/:id_mascota",
  authMiddleware,
  validate({ params: idMascotaParams, body: updateMascotaBody }),
  controller.updateMascota
);
router.delete(
  "/mascotas/:id_mascota",
  authMiddleware,
  validate({ params: idMascotaParams }),
  controller.deleteMascota
);

export default router;
