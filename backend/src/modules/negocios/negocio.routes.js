import express from "express";
import * as controller from "./negocio.controller.js";
import { createNegocioBody, idNegocioParams, updateNegocioBody } from "./negocio.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { authorize } from "../../shared/middlewares/authorize.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     NegocioInput:
 *       type: object
 *       additionalProperties: false
 *       description: >
 *         Campos opcionales con `null` se vacían. `latitud` y `longitud` van juntas.
 *         `ciudad`, `departamento` y `pais` toman por defecto Sincelejo, Sucre y Colombia.
 *       properties:
 *         nombre: { type: string, minLength: 2, maxLength: 150, example: Clínica Veterinaria Patitas }
 *         tipo: { type: string, enum: [veterinaria, tienda_mascotas, peluqueria_canina, guarderia, entrenador, clinica, multiservicio] }
 *         descripcion: { type: string, maxLength: 2000, nullable: true }
 *         telefono: { type: string, nullable: true, example: "6052801010" }
 *         whatsapp: { type: string, nullable: true, example: "3001112233" }
 *         email: { type: string, format: email, nullable: true }
 *         sitio_web: { type: string, format: uri, nullable: true }
 *         nit: { type: string, maxLength: 20, nullable: true, example: "900123456-7" }
 *         razon_social: { type: string, maxLength: 200, nullable: true }
 *         direccion: { type: string, maxLength: 300, nullable: true, example: "Calle 23 # 18-45, Centro" }
 *         ciudad: { type: string, maxLength: 100, example: Sincelejo }
 *         departamento: { type: string, maxLength: 100, example: Sucre }
 *         pais: { type: string, maxLength: 60, example: Colombia }
 *         codigo_postal: { type: string, maxLength: 10, nullable: true }
 *         latitud: { type: number, minimum: -90, maximum: 90, nullable: true, example: 9.30472 }
 *         longitud: { type: number, minimum: -180, maximum: 180, nullable: true, example: -75.39778 }
 *         logo_url: { type: string, format: uri, nullable: true }
 *         banner_url: { type: string, format: uri, nullable: true }
 *     Negocio:
 *       allOf:
 *         - $ref: '#/components/schemas/NegocioInput'
 *         - type: object
 *           properties:
 *             id_negocio: { type: integer, example: 1 }
 *             id_usuario_propietario: { type: integer, example: 2 }
 *             calificacion_promedio: { type: number, example: 4.5 }
 *             total_resenas: { type: integer }
 *             total_citas: { type: integer }
 *             verificado: { type: boolean }
 *             destacado: { type: boolean }
 *             activo: { type: boolean }
 *             fecha_registro: { type: string, example: "2026-09-25 10:00:00" }
 *             fecha_actualizacion: { type: string }
 *     NegocioMio:
 *       type: object
 *       properties:
 *         id_negocio: { type: integer }
 *         nombre: { type: string }
 *         tipo: { type: string }
 *         ciudad: { type: string }
 *         logo_url: { type: string, nullable: true }
 *         verificado: { type: boolean }
 *         activo: { type: boolean }
 *         relacion: { type: string, enum: [propietario, empleado] }
 *         id_empleado: { type: integer, nullable: true, description: Solo si relacion es empleado }
 *         rol:
 *           type: object
 *           nullable: true
 *           description: Rol del empleado en ese negocio (null para el propietario)
 *           properties:
 *             id_rol: { type: integer }
 *             nombre: { type: string, example: Veterinario }
 *     HorarioRango:
 *       type: object
 *       properties:
 *         dia_semana: { type: integer, minimum: 0, maximum: 6, description: "0 = domingo ... 6 = sábado" }
 *         hora_apertura: { type: string, example: "08:00" }
 *         hora_cierre: { type: string, example: "12:00" }
 *     NegocioPublico:
 *       type: object
 *       properties:
 *         id_negocio: { type: integer }
 *         nombre: { type: string }
 *         tipo: { type: string }
 *         descripcion: { type: string, nullable: true }
 *         telefono: { type: string, nullable: true }
 *         whatsapp: { type: string, nullable: true }
 *         email: { type: string, nullable: true }
 *         sitio_web: { type: string, nullable: true }
 *         direccion: { type: string, nullable: true }
 *         ciudad: { type: string }
 *         departamento: { type: string }
 *         latitud: { type: number, nullable: true }
 *         longitud: { type: number, nullable: true }
 *         logo_url: { type: string, nullable: true }
 *         banner_url: { type: string, nullable: true }
 *         calificacion_promedio: { type: number }
 *         total_resenas: { type: integer }
 *         verificado: { type: boolean }
 *         sucursales:
 *           type: array
 *           description: Solo activas, la principal primero
 *           items:
 *             allOf:
 *               - $ref: '#/components/schemas/Sucursal'
 *               - type: object
 *                 properties:
 *                   horarios: { type: array, items: { $ref: '#/components/schemas/HorarioRango' } }
 *         servicios:
 *           type: array
 *           description: Solo activos y visibles en la app
 *           items:
 *             type: object
 *             properties:
 *               id_servicio: { type: integer }
 *               nombre: { type: string }
 *               descripcion: { type: string, nullable: true }
 *               precio_base: { type: number }
 *               precio_maximo: { type: number, nullable: true }
 *               tipo_precio: { type: string, enum: [fijo, por_hora, por_dia, variable] }
 *               duracion_minutos: { type: integer }
 *               tipo_mascota: { type: array, items: { type: string }, example: [perro, gato] }
 *               en_oferta: { type: boolean }
 *               precio_oferta: { type: number, nullable: true }
 *               id_categoria: { type: integer }
 *               categoria: { type: string }
 *         resenas_recientes:
 *           type: array
 *           description: Las 5 reseñas visibles más recientes
 *           items:
 *             type: object
 *             properties:
 *               id_resena: { type: integer }
 *               calificacion: { type: integer, minimum: 1, maximum: 5 }
 *               titulo: { type: string, nullable: true }
 *               comentario: { type: string, nullable: true }
 *               respuesta_negocio: { type: string, nullable: true }
 *               fecha_respuesta: { type: string, nullable: true }
 *               fecha_creacion: { type: string }
 *               autor: { type: string, example: Sofía G. }
 */

/**
 * @swagger
 * /negocios:
 *   post:
 *     summary: Crear un negocio
 *     description: >
 *       Cualquier usuario autenticado puede crear un negocio y queda como propietario
 *       (el acceso al panel se decide por pertenencia, no por `tipo_usuario`). Se crea
 *       en la misma operación la suscripción al plan Gratuito, sin vencimiento.
 *     tags: [Negocios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/NegocioInput'
 *               - required: [nombre, tipo]
 *     responses:
 *       201:
 *         description: Negocio creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Negocio creado }
 *                 data: { $ref: '#/components/schemas/Negocio' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post("/negocios", authMiddleware, validate({ body: createNegocioBody }), controller.createNegocio);

/**
 * @swagger
 * /negocios/mios:
 *   get:
 *     summary: Negocios del usuario autenticado
 *     description: >
 *       Negocios a los que el usuario puede entrar en el panel: los propios (activos o no)
 *       y los activos donde es empleado activo, con la relación y el rol.
 *     tags: [Negocios]
 *     responses:
 *       200:
 *         description: Lista (vacía si no tiene ninguno)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { type: array, items: { $ref: '#/components/schemas/NegocioMio' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/negocios/mios", authMiddleware, controller.getMisNegocios);

/**
 * @swagger
 * /negocios/{id_negocio}:
 *   get:
 *     summary: Perfil público de un negocio
 *     description: Para la app. No requiere token. 404 si el negocio no existe o está inactivo.
 *     tags: [Negocios]
 *     security: []
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Perfil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { $ref: '#/components/schemas/NegocioPublico' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   patch:
 *     summary: Actualizar los datos del negocio
 *     description: Requiere el permiso `configuracion.editar` (el propietario siempre puede). Al menos un campo.
 *     tags: [Negocios]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/NegocioInput' }
 *     responses:
 *       200:
 *         description: Negocio actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Negocio actualizado }
 *                 data: { $ref: '#/components/schemas/Negocio' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get("/negocios/:id_negocio", validate({ params: idNegocioParams }), controller.getPerfilPublico);

router.patch(
  "/negocios/:id_negocio",
  authMiddleware,
  validate({ params: idNegocioParams, body: updateNegocioBody }),
  authorize("configuracion", "editar"),
  controller.updateNegocio
);

export default router;
