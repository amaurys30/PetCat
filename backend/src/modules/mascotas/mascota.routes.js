import express from "express";
import * as controller from "./mascota.controller.js";
import { createMascotaBody, idMascotaParams, incluirQuery, pesosQuery, updateMascotaBody } from "./mascota.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";
import { uploadLimiter } from "../../shared/middlewares/rateLimit.js";
import { recibirArchivos } from "../../shared/utils/uploads.js";

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
 *         foto_url: { type: string, nullable: true, description: "Foto (800 px); se sube con PUT /mascotas/{id_mascota}/foto" }
 *         foto_miniatura_url: { type: string, nullable: true, description: Miniatura cuadrada de 200 px }
 *         fallecido: { type: boolean }
 *         fecha_fallecimiento: { type: string, format: date, nullable: true }
 *         fecha_registro: { type: string, example: "2026-09-26 10:00:00" }
 *         fecha_actualizacion: { type: string, example: "2026-09-26 10:00:00" }
 *         resumen:
 *           allOf:
 *             - $ref: '#/components/schemas/ResumenMascota'
 *           x-opcional: true
 *           description: Solo con `?incluir=resumen` en GET /mascotas y GET /mascotas/{id_mascota} (rutas del dueño)
 *     ResumenMascota:
 *       type: object
 *       description: >
 *         Resumen corto de salud para las listas de la app, calculado en lote. Mismas reglas que
 *         GET /mascotas/{id_mascota}/resumen-salud. Solo lo recibe el dueño: incluye citas de cualquier negocio.
 *         Mascota fallecida: `estado_vacunas` null, sin eventos ni cita.
 *       properties:
 *         estado_vacunas:
 *           type: string
 *           nullable: true
 *           enum: [al_dia, proximo, vencido, sin_vacunas]
 *           description: vencido si alguna dosis vigente venció; proximo si alguna vence en `dias_aviso_vacuna` días (30); al_dia; sin_vacunas
 *         vacunas:
 *           type: object
 *           description: Conteo de dosis vigentes (la más reciente de cada vacuna)
 *           properties:
 *             vigentes: { type: integer, example: 6 }
 *             al_dia: { type: integer, example: 5 }
 *             proximas: { type: integer, example: 1 }
 *             vencidas: { type: integer, example: 0 }
 *         proximos_eventos:
 *           type: array
 *           description: >
 *             Vacunas vencidas o próximas y controles o desparasitaciones (proximo_control del historial) de los
 *             próximos `dias_aviso_vacuna` días; máximo 5, del más cercano al más lejano.
 *           items:
 *             type: object
 *             properties:
 *               tipo: { type: string, enum: [vacuna, desparasitacion, control] }
 *               titulo: { type: string, example: Antirrábica }
 *               fecha: { type: string, format: date }
 *               dias: { type: integer, description: Días desde hoy (negativo si ya venció), example: 20 }
 *               id_vacuna: { type: integer, nullable: true }
 *               id_historial: { type: integer, nullable: true }
 *               negocio:
 *                 type: object
 *                 nullable: true
 *                 properties: { id_negocio: { type: integer }, nombre: { type: string } }
 *         proxima_cita:
 *           type: object
 *           nullable: true
 *           description: La cita pendiente o confirmada más cercana que no ha terminado, de cualquier negocio
 *           properties:
 *             id_cita: { type: integer }
 *             fecha: { type: string, format: date }
 *             hora_inicio: { type: string, example: "08:30" }
 *             estado: { type: string, enum: [pendiente, confirmada] }
 *             servicio: { type: object, properties: { id_servicio: { type: integer }, nombre: { type: string } } }
 *             negocio: { type: object, properties: { id_negocio: { type: integer }, nombre: { type: string } } }
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
 *     description: >
 *       Mascotas del usuario autenticado sin las eliminadas; las fallecidas van al final. Con
 *       `incluir=resumen`, cada una trae `resumen` (salud, próximos eventos y próxima cita), calculado
 *       en lote para todas.
 *     tags: [Mascotas]
 *     parameters:
 *       - { in: query, name: incluir, schema: { type: string, enum: [resumen] } }
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
router.get("/mascotas", authMiddleware, validate({ query: incluirQuery }), controller.getMisMascotas);
router.post("/mascotas", authMiddleware, validate({ body: createMascotaBody }), controller.createMascota);

/**
 * @swagger
 * /mascotas/{id_mascota}:
 *   parameters:
 *     - { in: path, name: id_mascota, required: true, schema: { type: integer } }
 *   get:
 *     summary: Detalle de una mascota propia
 *     description: Con `incluir=resumen`, trae `resumen` (salud, próximos eventos y próxima cita).
 *     tags: [Mascotas]
 *     parameters:
 *       - { in: query, name: incluir, schema: { type: string, enum: [resumen] } }
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
router.get(
  "/mascotas/:id_mascota",
  authMiddleware,
  validate({ params: idMascotaParams, query: incluirQuery }),
  controller.getMascota
);

/**
 * @swagger
 * /mascotas/{id_mascota}/pesos:
 *   get:
 *     summary: Historial de peso de una mascota propia (app)
 *     description: >
 *       Solo el dueño. Los pesos de los últimos `meses`, del más antiguo al más reciente: los de los
 *       registros médicos (`origen: historial`, de cualquier negocio) y los que anota el dueño al crear o
 *       editar la mascota (`origen: dueno`, uno por día). Puede haber más de uno el mismo día.
 *     tags: [Mascotas]
 *     parameters:
 *       - { in: path, name: id_mascota, required: true, schema: { type: integer } }
 *       - { in: query, name: meses, schema: { type: integer, minimum: 1, maximum: 60, default: 12 } }
 *     responses:
 *       200:
 *         description: Historial de peso
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
 *                     peso_actual: { type: number, nullable: true, example: 28.4 }
 *                     puntos:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           fecha: { type: string, format: date }
 *                           peso: { type: number, example: 27.8 }
 *                           origen: { type: string, enum: [dueno, historial] }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/MascotaAjena' }
 *       404: { $ref: '#/components/responses/MascotaNoEncontrada' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/mascotas/:id_mascota/pesos",
  authMiddleware,
  validate({ params: idMascotaParams, query: pesosQuery }),
  controller.getPesos
);
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

/**
 * @swagger
 * /mascotas/{id_mascota}/foto:
 *   put:
 *     summary: Subir o reemplazar la foto de la mascota
 *     description: >
 *       Solo el dueño. multipart/form-data con el archivo en `foto`. La foto anterior se borra.
 *       Responde la mascota con `foto_url` (800 px) y `foto_miniatura_url` (200 px).
 *     tags: [Mascotas]
 *     parameters:
 *       - { in: path, name: id_mascota, required: true, schema: { type: integer } }
 *     requestBody: { $ref: '#/components/requestBodies/Foto' }
 *     responses:
 *       200:
 *         description: Foto actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Foto de la mascota actualizada }
 *                 data: { $ref: '#/components/schemas/Mascota' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ArchivoInvalido' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/AlmacenamientoNoDisponible' }
 *   delete:
 *     summary: Eliminar la foto de la mascota
 *     description: Solo el dueño. 404 si la mascota no tiene foto.
 *     tags: [Mascotas]
 *     parameters:
 *       - { in: path, name: id_mascota, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Foto eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Foto de la mascota eliminada }
 *                 data: { $ref: '#/components/schemas/Mascota' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.put(
  "/mascotas/:id_mascota/foto",
  authMiddleware,
  validate({ params: idMascotaParams }),
  uploadLimiter,
  recibirArchivos("mascota_foto"),
  controller.subirFoto
);
router.delete("/mascotas/:id_mascota/foto", authMiddleware, validate({ params: idMascotaParams }), controller.eliminarFoto);

export default router;
