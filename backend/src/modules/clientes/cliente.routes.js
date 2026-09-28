import express from "express";
import * as controller from "./cliente.controller.js";
import {
  agregarMascotaBody,
  buscarClienteQuery,
  citasClienteQuery,
  clienteParams,
  listClientesQuery,
  registrarClienteBody,
} from "./cliente.schemas.js";
import { idNegocioParams } from "../negocios/negocio.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { authorize, authorizeAny } from "../../shared/middlewares/authorize.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ClienteContacto:
 *       type: object
 *       properties:
 *         id_usuario: { type: integer }
 *         nombre: { type: string }
 *         apellido: { type: string }
 *         email: { type: string, format: email }
 *         telefono: { type: string, nullable: true }
 */

/**
 * @swagger
 * /negocios/{id_negocio}/clientes/buscar:
 *   get:
 *     summary: Buscar un cliente por email o teléfono exactos (panel)
 *     description: >
 *       Requiere `citas.crear` o `clientes.ver`. Coincidencia exacta: email sin distinguir mayúsculas,
 *       teléfono comparando solo los dígitos. Uno de los dos. Hasta 5 resultados (el teléfono no es
 *       único), solo usuarios activos, con sus mascotas activas y vivas. Lista vacía si no hay. Tiene el
 *       límite estricto de solicitudes para que no se puedan recorrer teléfonos.
 *     tags: [Clientes]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *       - { in: query, name: email, schema: { type: string, format: email } }
 *       - { in: query, name: telefono, schema: { type: string }, example: "300 123 4567" }
 *     responses:
 *       200:
 *         description: Clientes encontrados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data:
 *                   type: array
 *                   maxItems: 5
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/ClienteContacto'
 *                       - type: object
 *                         properties:
 *                           mascotas:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id_mascota: { type: integer }
 *                                 nombre: { type: string }
 *                                 especie: { type: string }
 *                                 raza: { type: string, nullable: true }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 */
router.get(
  "/negocios/:id_negocio/clientes/buscar",
  authMiddleware,
  validate({ params: idNegocioParams, query: buscarClienteQuery }),
  authorizeAny([
    ["citas", "crear"],
    ["clientes", "ver"],
  ]),
  controller.buscarClientes
);

/**
 * @swagger
 * /negocios/{id_negocio}/clientes:
 *   post:
 *     summary: Registrar un cliente sin app (panel)
 *     description: >
 *       Requiere `citas.crear`. Crea la cuenta del cliente con su primera mascota. Exige
 *       `autoriza_tratamiento_datos: true` (Ley 1581 de 2012): se guarda con la fecha, el negocio, quién
 *       la registró, la versión de la política y la IP. El cliente recibe un correo de bienvenida con el
 *       nombre del negocio y el enlace `${FRONTEND_URL}/crear-password/<token>` (vigente 7 días; se usa con
 *       `POST /auth/reset-password`). Después se agenda con `POST /negocios/{id_negocio}/citas`.
 *     tags: [Clientes]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [nombre, apellido, email, autoriza_tratamiento_datos, mascota]
 *             properties:
 *               nombre: { type: string, minLength: 2, maxLength: 80 }
 *               apellido: { type: string, minLength: 2, maxLength: 80 }
 *               email: { type: string, format: email, description: Obligatorio por ahora }
 *               telefono: { type: string }
 *               autoriza_tratamiento_datos: { type: boolean, enum: [true], description: El titular autorizó el tratamiento de sus datos }
 *               mascota:
 *                 allOf:
 *                   - $ref: '#/components/schemas/MascotaInput'
 *                   - required: [nombre, especie]
 *     responses:
 *       201:
 *         description: Cliente registrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Cliente registrado. Le enviamos un correo para que cree su contraseña }
 *                 data:
 *                   type: object
 *                   properties:
 *                     cliente: { $ref: '#/components/schemas/ClienteContacto' }
 *                     mascota: { $ref: '#/components/schemas/Mascota' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Ya existe una cuenta con ese correo (buscarla con clientes/buscar)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     ClienteFila:
 *       allOf:
 *         - $ref: '#/components/schemas/ClienteContacto'
 *         - type: object
 *           properties:
 *             total_citas: { type: integer, description: Con este negocio, en cualquier estado }
 *             ultima_cita: { type: string, format: date, nullable: true, description: Última cita ya pasada (sin canceladas ni reprogramadas) }
 *             proxima_cita: { type: string, format: date, nullable: true }
 *             inasistencias: { type: integer, description: Con este negocio }
 *     ClienteDetalle:
 *       type: object
 *       properties:
 *         cliente:
 *           allOf:
 *             - $ref: '#/components/schemas/ClienteContacto'
 *             - type: object
 *               properties:
 *                 cliente_desde: { type: string, format: date, description: Primera cita o autorización registrada por el negocio }
 *                 registrado_por_el_negocio: { type: boolean }
 *                 usa_app: { type: boolean, description: Alguna vez inició sesión }
 *         historial_cumplimiento:
 *           type: object
 *           description: Solo las citas del cliente con este negocio
 *           properties:
 *             completadas: { type: integer }
 *             inasistencias: { type: integer }
 *             cancelaciones_tardias: { type: integer }
 *         mascotas:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id_mascota: { type: integer }
 *               nombre: { type: string }
 *               especie: { type: string }
 *               raza: { type: string, nullable: true }
 *               edad_meses: { type: integer, nullable: true }
 *               peso: { type: number, nullable: true }
 *               tiene_alergias: { type: boolean }
 *               alergias_detalle: { type: string, nullable: true }
 *               condiciones_medicas: { type: string, nullable: true }
 *               fallecido: { type: boolean }
 *               citas_con_negocio: { type: integer }
 *               acceso_historial: { type: boolean, description: Tiene una cita válida con el negocio (se puede abrir su historial y vacunas) }
 *         citas:
 *           type: object
 *           properties:
 *             proximas: { type: array, items: { $ref: '#/components/schemas/CitaPanel' } }
 *             recientes: { type: array, description: Las últimas 10, items: { $ref: '#/components/schemas/CitaPanel' } }
 */

/**
 * @swagger
 * /negocios/{id_negocio}/clientes:
 *   get:
 *     summary: Clientes del negocio (panel)
 *     description: >
 *       Requiere `clientes.ver`. Cliente = usuario activo con alguna cita con el negocio (en cualquier estado)
 *       o registrado desde este panel. Todos los conteos son solo de este negocio. `q` busca en nombre,
 *       apellido, email, teléfono (dígitos) y nombre de sus mascotas.
 *     tags: [Clientes]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - { in: query, name: q, schema: { type: string, maxLength: 100 } }
 *       - { in: query, name: orden, schema: { type: string, enum: [ultima_cita, nombre, inasistencias], default: ultima_cita } }
 *     responses:
 *       200:
 *         description: Página de clientes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { type: array, items: { $ref: '#/components/schemas/ClienteFila' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/negocios/:id_negocio/clientes",
  authMiddleware,
  validate({ params: idNegocioParams, query: listClientesQuery }),
  authorize("clientes", "ver"),
  controller.listarClientes
);

/**
 * @swagger
 * /negocios/{id_negocio}/clientes/{id_usuario}:
 *   get:
 *     summary: Detalle de un cliente del negocio (panel)
 *     description: >
 *       Requiere `clientes.ver`. Contacto, cumplimiento (completadas, inasistencias y cancelaciones tardías),
 *       mascotas y citas próximas y recientes, todo solo con este negocio. 404 si el usuario no es cliente del
 *       negocio (no se revela si la cuenta existe).
 *     tags: [Clientes]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *       - { in: path, name: id_usuario, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Cliente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { $ref: '#/components/schemas/ClienteDetalle' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/negocios/:id_negocio/clientes/:id_usuario",
  authMiddleware,
  validate({ params: clienteParams }),
  authorize("clientes", "ver"),
  controller.getCliente
);

/**
 * @swagger
 * /negocios/{id_negocio}/clientes/{id_usuario}/citas:
 *   get:
 *     summary: Todas las citas de un cliente con el negocio (panel)
 *     description: Requiere `clientes.ver`. Paginadas, de la más reciente hacia atrás. 404 si no es cliente del negocio.
 *     tags: [Clientes]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *       - { in: path, name: id_usuario, required: true, schema: { type: integer } }
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - { in: query, name: estado, schema: { type: string }, example: "no_asistio,cancelada" }
 *     responses:
 *       200:
 *         description: Página de citas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { type: array, items: { $ref: '#/components/schemas/CitaPanel' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/negocios/:id_negocio/clientes/:id_usuario/citas",
  authMiddleware,
  validate({ params: clienteParams, query: citasClienteQuery }),
  authorize("clientes", "ver"),
  controller.getCitasCliente
);

router.post(
  "/negocios/:id_negocio/clientes",
  authMiddleware,
  validate({ params: idNegocioParams, body: registrarClienteBody }),
  authorize("citas", "crear"),
  controller.registrarCliente
);

/**
 * @swagger
 * /negocios/{id_negocio}/clientes/{id_usuario}/mascotas:
 *   post:
 *     summary: Registrar otra mascota de un cliente (panel)
 *     description: >
 *       Requiere `citas.crear`. Solo si el cliente tiene relación con el negocio: alguna cita con él o
 *       una autorización de datos que el negocio registró (403 si no). La mascota queda a nombre del cliente.
 *     tags: [Clientes]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *       - { in: path, name: id_usuario, required: true, schema: { type: integer } }
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
 *       403:
 *         description: Sin permiso, o el cliente no tiene relación con el negocio
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: Negocio o cliente no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  "/negocios/:id_negocio/clientes/:id_usuario/mascotas",
  authMiddleware,
  validate({ params: clienteParams, body: agregarMascotaBody }),
  authorize("citas", "crear"),
  controller.agregarMascota
);

export default router;
