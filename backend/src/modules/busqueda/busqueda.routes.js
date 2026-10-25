import express from "express";
import * as controller from "./busqueda.controller.js";
import { buscarNegociosQuery, buscarServiciosQuery } from "./busqueda.schemas.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   parameters:
 *     lat:
 *       in: query
 *       name: lat
 *       schema: { type: number, minimum: -90, maximum: 90 }
 *       description: >
 *         Latitud de la búsqueda, junto con `lng`. Con coordenadas solo aparecen los negocios con
 *         coordenadas dentro del radio: los que no tienen coordenadas en ninguna sucursal activa ni
 *         en el negocio quedan fuera (el negocio debe cargar su ubicación en el panel).
 *     lng:
 *       in: query
 *       name: lng
 *       schema: { type: number, minimum: -180, maximum: 180 }
 *       description: Longitud de la búsqueda, junto con `lat`.
 *     radio_km:
 *       in: query
 *       name: radio_km
 *       schema: { type: number, exclusiveMinimum: 0, maximum: 50 }
 *       description: Radio en km (requiere lat y lng). Por defecto `configuracion_global.radio_busqueda_km` (10).
 *   schemas:
 *     SucursalCercana:
 *       type: object
 *       nullable: true
 *       description: Sucursal más cercana a las coordenadas de la búsqueda (null sin coordenadas)
 *       properties:
 *         id_sucursal: { type: integer }
 *         nombre: { type: string }
 *         direccion: { type: string }
 *     NegocioBusqueda:
 *       type: object
 *       properties:
 *         id_negocio: { type: integer }
 *         nombre: { type: string }
 *         tipo: { type: string }
 *         descripcion: { type: string, nullable: true }
 *         ciudad: { type: string }
 *         logo_url: { type: string, nullable: true, description: Logo (800 px) }
 *         logo_miniatura_url: { type: string, nullable: true, description: Miniatura cuadrada de 200 px }
 *         calificacion_promedio: { type: number, example: 4.6 }
 *         total_resenas: { type: integer }
 *         verificado: { type: boolean }
 *         destacado: { type: boolean }
 *         distancia_km: { type: number, nullable: true, description: A la sucursal más cercana (null sin coordenadas) }
 *         sucursal_cercana: { $ref: '#/components/schemas/SucursalCercana' }
 *     ServicioPublico:
 *       type: object
 *       description: Servicio en la app.
 *       properties:
 *         id_servicio: { type: integer }
 *         nombre: { type: string }
 *         descripcion: { type: string, nullable: true }
 *         indicaciones_previas: { type: string, nullable: true, description: "Preparación antes de la cita (ayuno, carnet...)" }
 *         categoria:
 *           type: object
 *           properties:
 *             id_categoria: { type: integer }
 *             nombre: { type: string }
 *             icono: { type: string, nullable: true }
 *         negocio:
 *           type: object
 *           properties:
 *             id_negocio: { type: integer }
 *             nombre: { type: string }
 *             tipo: { type: string }
 *             logo_url: { type: string, nullable: true }
 *             logo_miniatura_url: { type: string, nullable: true }
 *             calificacion_promedio: { type: number }
 *             verificado: { type: boolean }
 *         precio_base: { type: number }
 *         precio_maximo: { type: number, nullable: true }
 *         tipo_precio: { type: string }
 *         precio_actual: { type: number, description: "Precio de oferta si está vigente hoy; si no, precio_base" }
 *         oferta_vigente: { type: boolean }
 *         oferta_hasta: { type: string, format: date, nullable: true, description: Último día de la oferta vigente }
 *         duracion_minutos: { type: integer }
 *         tipo_mascota: { type: array, items: { type: string } }
 *         peso_min_kg: { type: number, nullable: true }
 *         peso_max_kg: { type: number, nullable: true }
 *         dias_disponible: { type: array, nullable: true, items: { type: string }, description: null = todos los días }
 *         requiere_cita: { type: boolean }
 *         reservable:
 *           type: boolean
 *           description: >
 *             Se puede reservar: no requiere cita, o la requiere y tiene empleados activos asignados.
 *             Los no reservables se muestran igual (la app deshabilita la reserva).
 */

/**
 * @swagger
 * /negocios:
 *   get:
 *     summary: Buscar negocios (app)
 *     description: >
 *       Público. Negocios activos con al menos una sucursal activa. Con `lat`/`lng`, la distancia
 *       es la de la sucursal activa más cercana con coordenadas (o la del negocio si ninguna sucursal
 *       las tiene) y los negocios sin coordenadas quedan fuera. Orden: destacados primero; luego
 *       distancia (con coordenadas) o calificación y número de reseñas. Texto sin distinguir tildes ni mayúsculas.
 *     tags: [Búsqueda]
 *     security: []
 *     parameters:
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - { in: query, name: q, schema: { type: string, maxLength: 100 }, description: Busca en nombre y descripción }
 *       - { in: query, name: tipo, schema: { type: string, enum: [veterinaria, tienda_mascotas, peluqueria_canina, guarderia, entrenador, clinica, multiservicio] } }
 *       - { in: query, name: id_categoria, schema: { type: integer }, description: Negocios con servicios visibles de esa categoría }
 *       - $ref: '#/components/parameters/lat'
 *       - $ref: '#/components/parameters/lng'
 *       - $ref: '#/components/parameters/radio_km'
 *     responses:
 *       200:
 *         description: Página de negocios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { type: array, items: { $ref: '#/components/schemas/NegocioBusqueda' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get("/negocios", validate({ query: buscarNegociosQuery }), controller.buscarNegocios);

/**
 * @swagger
 * /servicios:
 *   get:
 *     summary: Buscar servicios (app)
 *     description: >
 *       Público. Servicios activos y visibles de negocios activos con al menos una sucursal activa.
 *       `especie` encuentra los servicios de esa especie y los de `todos` (pez y otro solo encuentran
 *       `todos`). Con `lat`/`lng`, los negocios sin coordenadas quedan fuera. Orden: reservables
 *       primero; luego distancia (con coordenadas), negocio destacado, calificación del negocio y nombre.
 *     tags: [Búsqueda]
 *     security: []
 *     parameters:
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - { in: query, name: q, schema: { type: string, maxLength: 100 }, description: Busca en nombre y descripción }
 *       - { in: query, name: id_categoria, schema: { type: integer } }
 *       - { in: query, name: id_negocio, schema: { type: integer } }
 *       - { in: query, name: especie, schema: { type: string, enum: [perro, gato, conejo, ave, reptil, roedor, pez, otro] } }
 *       - { in: query, name: en_oferta, schema: { type: string, enum: ["true", "false"] }, description: Oferta vigente hoy }
 *       - $ref: '#/components/parameters/lat'
 *       - $ref: '#/components/parameters/lng'
 *       - $ref: '#/components/parameters/radio_km'
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
 *                 data:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/ServicioPublico'
 *                       - type: object
 *                         properties:
 *                           distancia_km: { type: number, nullable: true }
 *                           sucursal_cercana: { $ref: '#/components/schemas/SucursalCercana' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get("/servicios", validate({ query: buscarServiciosQuery }), controller.buscarServicios);

export default router;
