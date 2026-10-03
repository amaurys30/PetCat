import express from "express";
import * as controller from "./negocio.controller.js";
import { createNegocioBody, idNegocioParams, updateNegocioBody } from "./negocio.schemas.js";
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
 *     NegocioInput:
 *       type: object
 *       additionalProperties: false
 *       description: >
 *         Campos opcionales con `null` se vacían. `latitud` y `longitud` van juntas.
 *         `ciudad`, `departamento` y `pais` toman por defecto Sincelejo, Sucre y Colombia.
 *         `logo_url` y `banner_url` no se aceptan (422): se suben con `PUT /negocios/{id_negocio}/logo` y `/banner`.
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
 *         confirmacion_automatica:
 *           type: boolean
 *           default: false
 *           description: >
 *             Las citas de la app (y las que reprograma el dueño) nacen confirmadas. Sin ella quedan pendientes
 *             y, si el negocio no las confirma a tiempo (`confirmar_antes_de` de la cita), se cancelan solas.
 *     Negocio:
 *       allOf:
 *         - $ref: '#/components/schemas/NegocioInput'
 *         - type: object
 *           properties:
 *             logo_url: { type: string, nullable: true, description: "Logo (800 px); se sube con PUT /negocios/{id_negocio}/logo" }
 *             logo_miniatura_url: { type: string, nullable: true, description: Miniatura cuadrada de 200 px }
 *             banner_url: { type: string, nullable: true, description: "Banner (hasta 1600 px); se sube con PUT /negocios/{id_negocio}/banner" }
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
 *     NegocioGestion:
 *       allOf:
 *         - $ref: '#/components/schemas/Negocio'
 *         - type: object
 *           properties:
 *             sucursales:
 *               type: array
 *               description: Solo activas, la principal primero (aunque el negocio esté inactivo)
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/Sucursal'
 *                   - type: object
 *                     properties:
 *                       horarios: { type: array, items: { $ref: '#/components/schemas/HorarioRango' } }
 *             reglas_confirmacion:
 *               type: object
 *               description: >
 *                 Cómo se confirman las citas pendientes. Los plazos son de la plataforma
 *                 (`configuracion_global`), iguales para todos los negocios.
 *               properties:
 *                 confirmacion_automatica: { type: boolean, description: Igual que el campo del negocio }
 *                 plazo_confirmacion_h:
 *                   type: integer
 *                   example: 24
 *                   description: >
 *                     Horas que tiene el negocio para confirmar una cita pendiente desde que se creó. Al
 *                     vencer, la cita se cancela sola (`cancelada_por = 'sistema'`).
 *                 confirmacion_antes_inicio_min:
 *                   type: integer
 *                   example: 60
 *                   description: >
 *                     El plazo nunca pasa de estos minutos antes del inicio de la cita. El plazo exacto de
 *                     cada cita está en su `confirmar_antes_de`.
 *                 citas_perdidas:
 *                   type: object
 *                   description: >
 *                     Citas que el sistema canceló porque nadie las confirmó, contadas por la fecha de
 *                     cancelación en los últimos `dias` días.
 *                   properties:
 *                     dias: { type: integer, example: 30 }
 *                     total: { type: integer, example: 4 }
 *                     sugerencia:
 *                       type: object
 *                       nullable: true
 *                       description: Solo si hubo alguna y la confirmación automática está apagada
 *                       properties:
 *                         codigo: { type: string, example: activar_confirmacion_automatica }
 *                         mensaje: { type: string }
 *     NegocioMio:
 *       type: object
 *       properties:
 *         id_negocio: { type: integer }
 *         nombre: { type: string }
 *         tipo: { type: string }
 *         ciudad: { type: string }
 *         logo_url: { type: string, nullable: true }
 *         logo_miniatura_url: { type: string, nullable: true }
 *         verificado: { type: boolean }
 *         activo: { type: boolean }
 *         configuracion_pendiente:
 *           type: string
 *           nullable: true
 *           enum: [sede, horarios, null]
 *           description: >
 *             Primer paso que le falta para recibir citas: `sede` si no tiene sucursales activas,
 *             `horarios` si ninguna sucursal activa tiene horario, null si está completo. El panel
 *             lo usa para retomar el asistente de creación.
 *         relacion: { type: string, enum: [propietario, empleado] }
 *         id_empleado: { type: integer, nullable: true, description: Solo si relacion es empleado }
 *         rol:
 *           type: object
 *           nullable: true
 *           description: >
 *             Rol del empleado en ese negocio (null para el propietario, que tiene todos los permisos).
 *             Trae sus permisos para que el panel muestre u oculte secciones; la API decide igual en cada ruta.
 *           properties:
 *             id_rol: { type: integer }
 *             nombre: { type: string, example: Veterinario }
 *             permisos_json: { $ref: '#/components/schemas/Permisos' }
 *         plan:
 *           type: object
 *           description: Plan efectivo (el Gratuito si la prueba o el plan pago vencieron)
 *           properties:
 *             id_plan: { type: integer }
 *             nombre: { type: string, example: Pro }
 *             en_prueba: { type: boolean }
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
 *         logo_miniatura_url: { type: string, nullable: true }
 *         banner_url: { type: string, nullable: true }
 *         calificacion_promedio: { type: number }
 *         total_resenas: { type: integer }
 *         verificado: { type: boolean }
 *         confirmacion_automatica: { type: boolean, description: "La reserva queda confirmada al instante (la app puede mostrarlo)" }
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
 *               precio_actual: { type: number, description: Precio de oferta si está vigente hoy; si no, precio_base }
 *               oferta_vigente: { type: boolean }
 *               reservable: { type: boolean, description: No requiere cita, o tiene empleados activos asignados }
 *               id_categoria: { type: integer }
 *               categoria: { type: string }
 *         resenas_recientes:
 *           type: array
 *           description: Las 5 reseñas visibles más recientes (todas en GET /negocios/{id_negocio}/resenas)
 *           items: { $ref: '#/components/schemas/ResenaPublica' }
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

/**
 * @swagger
 * /negocios/{id_negocio}/gestion:
 *   get:
 *     summary: Datos del negocio para el panel
 *     description: >
 *       Requiere `configuracion.ver` (el propietario siempre puede). A diferencia del perfil
 *       público, trae todas las columnas del negocio (`nit`, `razon_social`, `codigo_postal`,
 *       `pais`, `activo`...), funciona aunque el negocio esté inactivo e incluye las reglas de
 *       confirmación de citas.
 *     tags: [Negocios]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Negocio con sus sucursales y reglas de confirmación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { $ref: '#/components/schemas/NegocioGestion' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/negocios/:id_negocio/gestion",
  authMiddleware,
  validate({ params: idNegocioParams }),
  authorize("configuracion", "ver"),
  controller.getGestion
);

router.patch(
  "/negocios/:id_negocio",
  authMiddleware,
  validate({ params: idNegocioParams, body: updateNegocioBody }),
  authorize("configuracion", "editar"),
  controller.updateNegocio
);

/**
 * @swagger
 * /negocios/{id_negocio}/logo:
 *   put:
 *     summary: Subir o reemplazar el logo del negocio
 *     description: >
 *       Requiere `configuracion.editar`. multipart/form-data con el archivo en `logo` (PNG con
 *       transparencia se conserva). El logo anterior se borra. Responde el negocio con `logo_url`
 *       (800 px) y `logo_miniatura_url` (200 px).
 *     tags: [Negocios]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *     requestBody: { $ref: '#/components/requestBodies/Logo' }
 *     responses:
 *       200:
 *         description: Logo actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Logo actualizado }
 *                 data: { $ref: '#/components/schemas/Negocio' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ArchivoInvalido' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/AlmacenamientoNoDisponible' }
 *   delete:
 *     summary: Eliminar el logo del negocio
 *     description: Requiere `configuracion.editar`. 404 si no tiene logo.
 *     tags: [Negocios]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Logo eliminado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Logo eliminado }
 *                 data: { $ref: '#/components/schemas/Negocio' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 * /negocios/{id_negocio}/banner:
 *   put:
 *     summary: Subir o reemplazar el banner del negocio
 *     description: >
 *       Requiere `configuracion.editar`. multipart/form-data con el archivo en `banner`. El banner
 *       anterior se borra. `banner_url` es una versión de hasta 1600 px.
 *     tags: [Negocios]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *     requestBody: { $ref: '#/components/requestBodies/Banner' }
 *     responses:
 *       200:
 *         description: Banner actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Banner actualizado }
 *                 data: { $ref: '#/components/schemas/Negocio' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ArchivoInvalido' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 *       503: { $ref: '#/components/responses/AlmacenamientoNoDisponible' }
 *   delete:
 *     summary: Eliminar el banner del negocio
 *     description: Requiere `configuracion.editar`. 404 si no tiene banner.
 *     tags: [Negocios]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Banner eliminado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Banner eliminado }
 *                 data: { $ref: '#/components/schemas/Negocio' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
for (const tipo of ["logo", "banner"]) {
  router.put(
    `/negocios/:id_negocio/${tipo}`,
    authMiddleware,
    validate({ params: idNegocioParams }),
    authorize("configuracion", "editar"),
    uploadLimiter,
    recibirArchivos(`negocio_${tipo}`),
    controller.subirImagen(tipo)
  );
  router.delete(
    `/negocios/:id_negocio/${tipo}`,
    authMiddleware,
    validate({ params: idNegocioParams }),
    authorize("configuracion", "editar"),
    controller.eliminarImagen(tipo)
  );
}

export default router;
