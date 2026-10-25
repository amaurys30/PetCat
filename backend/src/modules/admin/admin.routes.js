import express from "express";
import * as controller from "./admin.controller.js";
import { negociosAdminQuery } from "./admin.schemas.js";
import { idNegocioParams } from "../negocios/negocio.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { soloAdmin } from "../../shared/middlewares/authorize.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Administración
 *     description: >
 *       Solo el super admin de PetCat (`tipo_usuario = admin`). Mientras no hay pagos en línea, asigna los
 *       planes a mano con `PUT /negocios/{id_negocio}/suscripcion`.
 * components:
 *   schemas:
 *     NegocioAdmin:
 *       type: object
 *       properties:
 *         id_negocio: { type: integer }
 *         nombre: { type: string, example: Clínica Veterinaria Patitas }
 *         tipo: { type: string, example: veterinaria }
 *         ciudad: { type: string, nullable: true }
 *         activo: { type: boolean }
 *         fecha_registro: { type: string }
 *         propietario:
 *           type: object
 *           properties:
 *             id_usuario: { type: integer }
 *             nombre: { type: string }
 *             apellido: { type: string }
 *             email: { type: string, nullable: true }
 *         plan:
 *           type: object
 *           description: Plan efectivo (el Gratuito si la prueba o el plan pago vencieron)
 *           properties:
 *             id_plan: { type: integer }
 *             nombre: { type: string, example: Pro }
 *         estado:
 *           type: string
 *           enum: [activa, en_prueba, vencida]
 *           description: "vencida: la prueba o el plan pago terminaron y el negocio volvió al Gratuito"
 *         suscripcion:
 *           type: object
 *           nullable: true
 *           description: Suscripción vigente (la más reciente activa o en prueba)
 *           properties:
 *             id_suscripcion: { type: integer }
 *             plan: { type: object, properties: { id_plan: { type: integer }, nombre: { type: string } } }
 *             estado: { type: string, enum: [activa, en_prueba, vencida] }
 *             tipo_facturacion: { type: string, enum: [mensual, anual] }
 *             fecha_inicio: { type: string, format: date }
 *             fecha_fin: { type: string, description: "9999-12-31 = sin vencimiento" }
 *             fecha_prueba_fin: { type: string, nullable: true }
 *         citas_mes:
 *           type: object
 *           properties:
 *             mes: { type: string, example: "2026-10" }
 *             usadas: { type: integer, example: 26 }
 *             maximo: { type: integer, example: 30, description: "-1 = ilimitado" }
 *     SuscripcionHistorial:
 *       type: object
 *       properties:
 *         id_suscripcion: { type: integer }
 *         plan: { type: object, properties: { id_plan: { type: integer }, nombre: { type: string } } }
 *         estado: { type: string, enum: [activa, vencida, cancelada, en_prueba, pendiente] }
 *         tipo_facturacion: { type: string, enum: [mensual, anual] }
 *         fecha_inicio: { type: string, format: date }
 *         fecha_fin: { type: string }
 *         fecha_prueba_fin: { type: string, nullable: true }
 *         monto_pagado: { type: number }
 *         notas: { type: string, nullable: true }
 *         fecha_creacion: { type: string }
 *         registrada_por:
 *           type: object
 *           nullable: true
 *           description: >
 *             Quién la creó: el admin que asignó el plan o el propietario que activó la prueba. Null en la
 *             Gratuita que se crea con el negocio y en las anteriores a la migración 025.
 *           properties:
 *             id_usuario: { type: integer }
 *             nombre: { type: string }
 *             apellido: { type: string }
 *             email: { type: string, nullable: true }
 *             es_admin: { type: boolean }
 */

/**
 * @swagger
 * /admin/negocios:
 *   get:
 *     summary: Negocios con su plan y su uso (super admin)
 *     description: >
 *       Todos los negocios, activos o no, con el propietario, el plan y el estado efectivos (calculados como
 *       en la suscripción del negocio), la suscripción vigente y las citas del mes. Ordenados por nombre.
 *     tags: [Administración]
 *     parameters:
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - { in: query, name: q, schema: { type: string }, description: "Nombre, ciudad o correo del propietario (sin distinguir tildes)" }
 *       - { in: query, name: id_plan, schema: { type: integer }, description: Plan efectivo }
 *       - { in: query, name: estado, schema: { type: string, enum: [activa, en_prueba, vencida] } }
 *     responses:
 *       200:
 *         description: Negocios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { type: array, items: { $ref: '#/components/schemas/NegocioAdmin' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get("/admin/negocios", authMiddleware, validate({ query: negociosAdminQuery }), soloAdmin, controller.getNegocios);

/**
 * @swagger
 * /admin/negocios/{id_negocio}/suscripciones:
 *   get:
 *     summary: Historial de suscripciones de un negocio (super admin)
 *     description: Todas las suscripciones, de la más reciente a la más antigua, con quién creó cada una.
 *     tags: [Administración]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
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
 *                 data: { type: array, items: { $ref: '#/components/schemas/SuscripcionHistorial' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/admin/negocios/:id_negocio/suscripciones",
  authMiddleware,
  validate({ params: idNegocioParams }),
  soloAdmin,
  controller.getHistorialSuscripciones
);

export default router;
