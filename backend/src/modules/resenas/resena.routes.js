import express from "express";
import * as controller from "./resena.controller.js";
import {
  gestionQuery,
  idResenaParams,
  misResenasQuery,
  publicasQuery,
  reporteBody,
  resenaBody,
  respuestaBody,
} from "./resena.schemas.js";
import { idCitaParams } from "../citas/cita.schemas.js";
import { idNegocioParams } from "../negocios/negocio.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { authorize } from "../../shared/middlewares/authorize.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Reseñas
 *     description: >
 *       El dueño reseña una cita completada (una vez, hasta 30 días después) y el negocio responde y
 *       reporta. Una reseña reportada sigue publicada hasta que PetCat la revise.
 * components:
 *   schemas:
 *     ResenaInput:
 *       type: object
 *       additionalProperties: false
 *       required: [calificacion]
 *       properties:
 *         calificacion: { type: integer, minimum: 1, maximum: 5 }
 *         titulo: { type: string, maxLength: 150 }
 *         comentario: { type: string, maxLength: 1000 }
 *         aspectos:
 *           type: object
 *           additionalProperties: false
 *           description: Calificaciones opcionales por aspecto, de 1 a 5
 *           properties:
 *             atencion: { type: integer, minimum: 1, maximum: 5 }
 *             precio: { type: integer, minimum: 1, maximum: 5 }
 *             instalaciones: { type: integer, minimum: 1, maximum: 5 }
 *             puntualidad: { type: integer, minimum: 1, maximum: 5 }
 *     ResenaBase:
 *       type: object
 *       properties:
 *         id_resena: { type: integer }
 *         calificacion: { type: integer, minimum: 1, maximum: 5 }
 *         aspectos:
 *           type: object
 *           properties:
 *             atencion: { type: integer, nullable: true }
 *             precio: { type: integer, nullable: true }
 *             instalaciones: { type: integer, nullable: true }
 *             puntualidad: { type: integer, nullable: true }
 *         titulo: { type: string, nullable: true }
 *         comentario: { type: string, nullable: true }
 *         fecha_creacion: { type: string, example: "2026-09-20 18:40:00" }
 *         fecha_edicion: { type: string, nullable: true, description: Última edición del autor }
 *         editada_despues_de_respuesta:
 *           type: boolean
 *           description: El autor la cambió después de la última respuesta del negocio (la app puede indicarlo junto a la respuesta)
 *         respuesta:
 *           type: object
 *           nullable: true
 *           properties:
 *             texto: { type: string }
 *             fecha: { type: string, description: De la última versión }
 *             editada: { type: boolean }
 *     ResenaPublica:
 *       allOf:
 *         - $ref: '#/components/schemas/ResenaBase'
 *         - type: object
 *           properties:
 *             autor: { type: string, example: Sofía G., description: Nombre e inicial del apellido; sin datos de contacto }
 *             visita_verificada: { type: string, nullable: true, example: "2026-09", description: Mes y año de la cita reseñada }
 *     ResenaDelAutor:
 *       allOf:
 *         - $ref: '#/components/schemas/ResenaBase'
 *         - type: object
 *           properties:
 *             id_cita: { type: integer }
 *             negocio:
 *               type: object
 *               properties: { id_negocio: { type: integer }, nombre: { type: string }, logo_url: { type: string, nullable: true } }
 *             servicio:
 *               type: object
 *               nullable: true
 *               properties: { id_servicio: { type: integer }, nombre: { type: string } }
 *             visible: { type: boolean, description: false si la ocultó la moderación de PetCat }
 *             editar_antes_de: { type: string, nullable: true, example: "2026-10-20 18:30:00" }
 *             puede_editar: { type: boolean }
 *     ResenaPanel:
 *       allOf:
 *         - $ref: '#/components/schemas/ResenaBase'
 *         - type: object
 *           properties:
 *             autor: { type: string, example: Sofía G., description: "Como se muestra en la app y en el perfil público (nombre e inicial del apellido)" }
 *             cliente:
 *               type: object
 *               properties: { id_usuario: { type: integer }, nombre: { type: string }, apellido: { type: string } }
 *             cita:
 *               type: object
 *               nullable: true
 *               properties:
 *                 id_cita: { type: integer }
 *                 fecha: { type: string, format: date }
 *                 servicio:
 *                   type: object
 *                   nullable: true
 *                   properties: { id_servicio: { type: integer }, nombre: { type: string } }
 *             visible: { type: boolean, description: "false si la ocultó la moderación de PetCat o si la retiró su autor (ver estado)" }
 *             estado:
 *               type: string
 *               enum: [publicada, oculta, retirada]
 *               description: "publicada; oculta por la moderación de PetCat; retirada por su autor (retirada_en)"
 *             retirada_en: { type: string, nullable: true, example: "2026-10-02 18:40:00", description: Cuándo la retiró su autor }
 *             reporte:
 *               type: object
 *               nullable: true
 *               properties:
 *                 motivo: { type: string, enum: [lenguaje_ofensivo, datos_personales, no_relacionada, spam, otro] }
 *                 detalle: { type: string, nullable: true }
 *                 fecha: { type: string }
 *                 reportada_por:
 *                   type: object
 *                   nullable: true
 *                   properties: { id_usuario: { type: integer }, nombre: { type: string }, apellido: { type: string } }
 */

/**
 * @swagger
 * /citas/{id_cita}/resena:
 *   post:
 *     summary: Reseñar una cita (app)
 *     description: >
 *       Solo el dueño de la cita, con la cita `completada`, una vez por cita (tampoco si retiró la reseña) y
 *       hasta `resena_plazo_dias` (30) días después de completada (`resena.resenar_antes_de` en la cita). El
 *       propietario y los empleados activos del negocio no pueden reseñarlo. Actualiza la calificación del
 *       negocio y avisa (`resena_nueva`) al propietario y a quien tiene `resenas.responder`.
 *     tags: [Reseñas]
 *     parameters:
 *       - { in: path, name: id_cita, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ResenaInput' }
 *     responses:
 *       201:
 *         description: Reseña publicada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Reseña publicada }
 *                 data: { $ref: '#/components/schemas/ResenaDelAutor' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: No es el dueño de la cita, o es propietario o empleado del negocio
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { success: false, message: "El propietario y los empleados del negocio no pueden reseñarlo" }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: La cita no está completada, ya se reseñó (o se retiró la reseña) o terminó el plazo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { success: false, message: "Terminó el plazo de 30 días para reseñar después de la cita" }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  "/citas/:id_cita/resena",
  authMiddleware,
  validate({ params: idCitaParams, body: resenaBody }),
  controller.crearResena
);

/**
 * @swagger
 * /resenas/mias:
 *   get:
 *     summary: Mis reseñas (app)
 *     description: Las del usuario, sin las que retiró, de la más reciente a la más antigua.
 *     tags: [Reseñas]
 *     parameters:
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *     responses:
 *       200:
 *         description: Reseñas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { type: array, items: { $ref: '#/components/schemas/ResenaDelAutor' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get("/resenas/mias", authMiddleware, validate({ query: misResenasQuery }), controller.getMisResenas);

/**
 * @swagger
 * /resenas/{id_resena}:
 *   put:
 *     summary: Editar mi reseña (app)
 *     description: >
 *       Solo el autor, dentro del plazo para reseñar (`editar_antes_de`). Reemplaza la reseña completa: lo que
 *       no se envía queda vacío. Si el negocio ya respondió, la reseña queda con `editada_despues_de_respuesta`.
 *     tags: [Reseñas]
 *     parameters:
 *       - { in: path, name: id_resena, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ResenaInput' }
 *     responses:
 *       200:
 *         description: Reseña actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Reseña actualizada }
 *                 data: { $ref: '#/components/schemas/ResenaDelAutor' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { description: "No existe, no es del usuario o la retiró", content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       409: { description: Terminó el plazo para editarla, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   delete:
 *     summary: Retirar mi reseña (app)
 *     description: >
 *       Solo el autor, en cualquier momento. Deja de verse y de contar en la calificación del negocio, y no se
 *       puede volver a reseñar esa cita. El negocio deja de verla.
 *     tags: [Reseñas]
 *     parameters:
 *       - { in: path, name: id_resena, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Reseña retirada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Reseña retirada }
 *                 data: { nullable: true, example: null }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { description: "No existe, no es del usuario o ya la retiró", content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.put(
  "/resenas/:id_resena",
  authMiddleware,
  validate({ params: idResenaParams, body: resenaBody }),
  controller.editarResena
);

router.delete("/resenas/:id_resena", authMiddleware, validate({ params: idResenaParams }), controller.retirarResena);

/**
 * @swagger
 * /negocios/{id_negocio}/resenas:
 *   get:
 *     summary: Reseñas de un negocio (público)
 *     description: >
 *       No requiere token. Solo las visibles (una reseña reportada sigue aquí hasta que PetCat la revise, y
 *       no se indica que está reportada). El autor sale como "Nombre I." y la visita solo con mes y año.
 *       `meta.resumen` trae la calificación promedio, el total y cuántas hay de cada calificación.
 *       404 si el negocio no existe o está inactivo.
 *     tags: [Reseñas]
 *     security: []
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - { in: query, name: orden, schema: { type: string, enum: [recientes, mejores, peores], default: recientes } }
 *       - { in: query, name: calificacion, schema: { type: integer, minimum: 1, maximum: 5 }, description: Solo las de esa calificación }
 *       - { in: query, name: calificacion_max, schema: { type: integer, minimum: 1, maximum: 5 }, description: "De 1 hasta esa calificación; no va junto con calificacion" }
 *     responses:
 *       200:
 *         description: Reseñas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { type: array, items: { $ref: '#/components/schemas/ResenaPublica' } }
 *                 meta:
 *                   allOf:
 *                     - $ref: '#/components/schemas/PaginationMeta'
 *                     - type: object
 *                       properties:
 *                         resumen:
 *                           type: object
 *                           properties:
 *                             calificacion_promedio: { type: number, example: 4.5 }
 *                             total_resenas: { type: integer, example: 12 }
 *                             distribucion:
 *                               type: object
 *                               example: { "1": 0, "2": 1, "3": 1, "4": 3, "5": 7 }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/negocios/:id_negocio/resenas",
  validate({ params: idNegocioParams, query: publicasQuery }),
  controller.getResenasPublicas
);

/**
 * @swagger
 * /negocios/{id_negocio}/resenas/gestion:
 *   get:
 *     summary: Reseñas del negocio (panel)
 *     description: >
 *       Requiere `resenas.ver`. Incluye las publicadas, las ocultas por la moderación y las que retiró su
 *       autor (`estado`), con el reporte, el nombre completo del cliente, el autor como se ve en público y
 *       la cita. `meta.resumen` trae la calificación, la distribución (de las visibles) y los conteos para
 *       los filtros; no depende de los filtros. Nunca incluye `cliente_registrado_por_negocio`, tampoco
 *       para el super admin: es un dato de moderación.
 *     tags: [Reseñas]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - { in: query, name: orden, schema: { type: string, enum: [recientes, mejores, peores], default: recientes } }
 *       - { in: query, name: calificacion, schema: { type: integer, minimum: 1, maximum: 5 } }
 *       - { in: query, name: calificacion_max, schema: { type: integer, minimum: 1, maximum: 5 }, description: "De 1 hasta esa calificación (2 = 1 y 2 estrellas); no va junto con calificacion" }
 *       - { in: query, name: estado, schema: { type: string, enum: [publicada, oculta, retirada] } }
 *       - { in: query, name: sin_responder, schema: { type: boolean }, description: "true: publicadas sin respuesta" }
 *       - { in: query, name: reportada, schema: { type: boolean } }
 *       - { in: query, name: visible, schema: { type: boolean } }
 *       - { in: query, name: id_resena, schema: { type: integer }, description: "Solo esa reseña (el enlace de la notificación resena_nueva)" }
 *     responses:
 *       200:
 *         description: Reseñas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { type: array, items: { $ref: '#/components/schemas/ResenaPanel' } }
 *                 meta:
 *                   allOf:
 *                     - $ref: '#/components/schemas/PaginationMeta'
 *                     - type: object
 *                       properties:
 *                         resumen:
 *                           type: object
 *                           properties:
 *                             calificacion_promedio: { type: number, example: 4.7 }
 *                             total_resenas: { type: integer, example: 38 }
 *                             distribucion: { type: object, example: { "1": 1, "2": 1, "3": 2, "4": 6, "5": 28 }, description: "De las visibles, por estrellas" }
 *                             sin_responder: { type: integer, description: Publicadas sin respuesta }
 *                             reportadas: { type: integer, description: "Reportadas por el negocio (sin las retiradas)" }
 *                             ocultas: { type: integer, description: Ocultas por la moderación de PetCat }
 *                             retiradas: { type: integer, description: Retiradas por su autor }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/negocios/:id_negocio/resenas/gestion",
  authMiddleware,
  validate({ params: idNegocioParams, query: gestionQuery }),
  authorize("resenas", "ver"),
  controller.getResenasGestion
);

/**
 * @swagger
 * /resenas/{id_resena}/respuesta:
 *   put:
 *     summary: Responder una reseña (panel)
 *     description: >
 *       Requiere `resenas.responder`: la respuesta es pública y habla en nombre del negocio. Crea o reemplaza
 *       la respuesta. La primera avisa al dueño (`resena_respondida`); las ediciones no.
 *     tags: [Reseñas]
 *     parameters:
 *       - { in: path, name: id_resena, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [respuesta]
 *             properties:
 *               respuesta: { type: string, maxLength: 1000 }
 *     responses:
 *       200:
 *         description: Respuesta publicada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Respuesta publicada }
 *                 data: { $ref: '#/components/schemas/ResenaPanel' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { description: No existe o su autor la retiró, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   delete:
 *     summary: Borrar la respuesta (panel)
 *     description: Requiere `resenas.responder`. Si después se responde otra vez, el dueño no recibe un aviso nuevo.
 *     tags: [Reseñas]
 *     parameters:
 *       - { in: path, name: id_resena, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Respuesta eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Respuesta eliminada }
 *                 data: { $ref: '#/components/schemas/ResenaPanel' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { description: La reseña no tiene respuesta, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.put(
  "/resenas/:id_resena/respuesta",
  authMiddleware,
  validate({ params: idResenaParams, body: respuestaBody }),
  authorize("resenas", "responder"),
  controller.responderResena
);

router.delete(
  "/resenas/:id_resena/respuesta",
  authMiddleware,
  validate({ params: idResenaParams }),
  authorize("resenas", "responder"),
  controller.borrarRespuesta
);

/**
 * @swagger
 * /resenas/{id_resena}/reportar:
 *   post:
 *     summary: Reportar una reseña (panel)
 *     description: >
 *       Requiere `resenas.reportar`. Una vez por reseña. La reseña **sigue publicada y cuenta en la
 *       calificación** hasta que el super admin de PetCat la revise (Fase 4): reportar no sirve para ocultar
 *       críticas. `detalle` es obligatorio con el motivo `otro`.
 *     tags: [Reseñas]
 *     parameters:
 *       - { in: path, name: id_resena, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [motivo]
 *             properties:
 *               motivo: { type: string, enum: [lenguaje_ofensivo, datos_personales, no_relacionada, spam, otro] }
 *               detalle: { type: string, maxLength: 500 }
 *     responses:
 *       200:
 *         description: Reseña reportada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Reseña reportada: PetCat la revisará" }
 *                 data: { $ref: '#/components/schemas/ResenaPanel' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { description: Ya fue reportada, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  "/resenas/:id_resena/reportar",
  authMiddleware,
  validate({ params: idResenaParams, body: reporteBody }),
  authorize("resenas", "reportar"),
  controller.reportarResena
);

export default router;
