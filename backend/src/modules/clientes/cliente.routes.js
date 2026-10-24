import express from "express";
import * as controller from "./cliente.controller.js";
import {
  agregarMascotaBody,
  buscarClienteQuery,
  citasClienteQuery,
  citasMascotaParams,
  citasMascotaQuery,
  clienteParams,
  idNotaParams,
  listClientesQuery,
  notaBody,
  notasQuery,
  correoClienteBody,
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
 *         email:
 *           type: string
 *           format: email
 *           nullable: true
 *           description: null en un cliente sin cuenta (registrado desde el panel sin correo; tiene teléfono)
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
 *                           usa_app: { type: boolean, description: Alguna vez inició sesión }
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
 *       la registró, la versión de la política y la IP. Con correo, el cliente recibe la bienvenida con el
 *       nombre del negocio y el enlace `${FRONTEND_URL}/crear-password/<token>` (vigente 7 días; se usa con
 *       `POST /auth/reset-password`). Sin correo queda **sin cuenta** (`sin_cuenta: true`): el teléfono es
 *       obligatorio (422), no recibe correos ni recordatorios y no puede iniciar sesión; si ya hay un cliente
 *       del negocio con ese teléfono, 409 (buscarlo con clientes/buscar y agregarle la mascota). Después se agenda con
 *       `POST /negocios/{id_negocio}/citas`.
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
 *             required: [nombre, apellido, autoriza_tratamiento_datos, mascota]
 *             properties:
 *               nombre: { type: string, minLength: 2, maxLength: 80 }
 *               apellido: { type: string, minLength: 2, maxLength: 80 }
 *               email: { type: string, format: email, description: Sin correo, el cliente queda sin cuenta }
 *               telefono: { type: string, description: Obligatorio si no hay correo }
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
 *                 message:
 *                   type: string
 *                   enum:
 *                     - Cliente registrado. Le enviamos un correo para que cree su contraseña
 *                     - "Cliente registrado sin cuenta: no recibirá correos ni recordatorios y no podrá entrar a la app"
 *                 data:
 *                   type: object
 *                   properties:
 *                     cliente: { $ref: '#/components/schemas/ClienteContacto' }
 *                     mascota: { $ref: '#/components/schemas/Mascota' }
 *                     sin_cuenta: { type: boolean, description: Se registró sin correo }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: >
 *           Ya existe una cuenta con ese correo o, sin correo, un cliente del negocio con ese teléfono. En una familia es
 *           común compartir el teléfono: se busca con clientes/buscar y se le agrega la mascota a ese cliente
 *           (POST /negocios/{id_negocio}/clientes/{id_usuario}/mascotas).
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
 *             usa_app: { type: boolean, description: Alguna vez inició sesión }
 *             registrado_por_el_negocio: { type: boolean }
 *             cliente_desde: { type: string, format: date, description: Primera cita o autorización registrada por el negocio }
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
 *                 correo_editable:
 *                   type: boolean
 *                   description: >
 *                     El negocio puede ponerle correo (no tiene) o corregirlo (lo registró este negocio y aún no activó
 *                     su cuenta) con PUT /negocios/{id_negocio}/clientes/{id_usuario}/correo
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
 *         notas_recientes: { type: array, description: Las 3 últimas notas del negocio sobre el cliente, items: { $ref: '#/components/schemas/NotaCliente' } }
 *         total_notas: { type: integer }
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
 *       mascotas, citas próximas y recientes y las últimas notas del negocio, todo solo con este negocio. 404 si el usuario no es cliente del
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

/**
 * @swagger
 * components:
 *   schemas:
 *     NotaCliente:
 *       type: object
 *       properties:
 *         id_nota: { type: integer }
 *         texto: { type: string, maxLength: 1000 }
 *         autor:
 *           type: object
 *           nullable: true
 *           description: null si la cuenta del autor ya no existe ("Ex miembro del equipo")
 *           properties: { id_usuario: { type: integer }, nombre: { type: string }, apellido: { type: string } }
 *         fecha_creacion: { type: string, example: "2026-09-29 10:15:00" }
 *         fecha_edicion: { type: string, nullable: true }
 *         editable: { type: boolean, description: Quien consulta es el autor }
 *         eliminable: { type: boolean, description: Quien consulta es el autor o el propietario }
 *     NotaInput:
 *       type: object
 *       additionalProperties: false
 *       required: [texto]
 *       properties:
 *         texto: { type: string, minLength: 1, maxLength: 1000, example: Prefiere que lo llamen en la tarde }
 */

/**
 * @swagger
 * /negocios/{id_negocio}/clientes/{id_usuario}/notas:
 *   get:
 *     summary: Notas del negocio sobre un cliente (panel)
 *     description: >
 *       Requiere `clientes.ver`. Solo las de este negocio, de la más reciente a la más antigua. Nunca las ve el
 *       cliente ni otro negocio. 404 si el usuario no es cliente del negocio.
 *     tags: [Clientes]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *       - { in: path, name: id_usuario, required: true, schema: { type: integer } }
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *     responses:
 *       200:
 *         description: Página de notas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data: { type: array, items: { $ref: '#/components/schemas/NotaCliente' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   post:
 *     summary: Escribir una nota sobre un cliente (panel)
 *     description: >
 *       Requiere `clientes.editar`. Queda con su autor y fecha. No escribir diagnósticos (van al historial
 *       médico) ni datos sensibles: la nota es un dato personal del cliente y, por la Ley 1581, el titular
 *       puede pedir conocerla.
 *     tags: [Clientes]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *       - { in: path, name: id_usuario, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/NotaInput' }
 *     responses:
 *       201:
 *         description: Nota guardada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Nota guardada }
 *                 data: { $ref: '#/components/schemas/NotaCliente' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/negocios/:id_negocio/clientes/:id_usuario/notas",
  authMiddleware,
  validate({ params: clienteParams, query: notasQuery }),
  authorize("clientes", "ver"),
  controller.getNotas
);

router.post(
  "/negocios/:id_negocio/clientes/:id_usuario/notas",
  authMiddleware,
  validate({ params: clienteParams, body: notaBody }),
  authorize("clientes", "editar"),
  controller.crearNota
);

/**
 * @swagger
 * /notas-cliente/{id_nota}:
 *   patch:
 *     summary: Editar una nota (panel)
 *     description: Requiere `clientes.editar` y ser su autor (403 si no). Una nota de otro negocio da 403, como todo recurso ajeno.
 *     tags: [Clientes]
 *     parameters:
 *       - { in: path, name: id_nota, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/NotaInput' }
 *     responses:
 *       200:
 *         description: Nota actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Nota actualizada }
 *                 data: { $ref: '#/components/schemas/NotaCliente' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   delete:
 *     summary: Borrar una nota (panel)
 *     description: >
 *       Requiere `clientes.editar` y ser su autor o el propietario del negocio. Borrado físico: la nota
 *       desaparece (excepción a la convención de borrado lógico).
 *     tags: [Clientes]
 *     parameters:
 *       - { in: path, name: id_nota, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Nota eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Nota eliminada }
 *                 data: { nullable: true, example: null }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  "/notas-cliente/:id_nota",
  authMiddleware,
  validate({ params: idNotaParams, body: notaBody }),
  authorize("clientes", "editar"),
  controller.editarNota
);

router.delete(
  "/notas-cliente/:id_nota",
  authMiddleware,
  validate({ params: idNotaParams }),
  authorize("clientes", "editar"),
  controller.borrarNota
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

/**
 * @swagger
 * /negocios/{id_negocio}/clientes/{id_usuario}/correo:
 *   put:
 *     summary: Poner o corregir el correo de un cliente sin cuenta activa (panel)
 *     description: >
 *       Requiere `citas.crear` o `clientes.editar`. Le envía la bienvenida con el nombre del negocio y el enlace
 *       `${FRONTEND_URL}/crear-password/<token>` (vigente 7 días); al crear su contraseña con
 *       `POST /auth/reset-password` la cuenta queda activa y puede entrar a la app. Se permite si el cliente no tiene
 *       correo, o para corregir el de un cliente que registró este negocio y que aún no activó su cuenta
 *       (`correo_editable` del detalle). Al corregirlo, el enlace anterior deja de servir. Con el mismo correo
 *       es un reenvío de la bienvenida. Tiene el límite estricto de solicitudes.
 *     tags: [Clientes]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *       - { in: path, name: id_usuario, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email, maxLength: 150 }
 *     responses:
 *       200:
 *         description: Correo guardado y bienvenida enviada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message:
 *                   type: string
 *                   enum:
 *                     - Correo agregado. Le enviamos la bienvenida para que active su cuenta
 *                     - Correo corregido. Le enviamos una bienvenida nueva; el enlace anterior ya no sirve
 *                     - Le reenviamos la bienvenida
 *                 data:
 *                   type: object
 *                   properties:
 *                     cliente: { $ref: '#/components/schemas/ClienteContacto' }
 *                     accion: { type: string, enum: [agregado, corregido, reenviado] }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Sin permiso, o el cliente ya tiene correo y no lo registró este negocio
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: El cliente ya activó su cuenta (solo él cambia su correo) o el correo es de otra cuenta
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 */
router.put(
  "/negocios/:id_negocio/clientes/:id_usuario/correo",
  authMiddleware,
  validate({ params: clienteParams, body: correoClienteBody }),
  authorizeAny([
    ["citas", "crear"],
    ["clientes", "editar"],
  ]),
  controller.asignarCorreo
);

/**
 * @swagger
 * /negocios/{id_negocio}/mascotas/{id_mascota}/citas:
 *   get:
 *     summary: Citas de una mascota con el negocio (panel)
 *     description: >
 *       Requiere `citas.ver` o `clientes.ver` (un veterinario ve en la ficha las citas de la mascota, igual que en la
 *       agenda). Solo las citas con este negocio, paginadas, de la más reciente hacia atrás. 404 si la mascota no
 *       existe, su dueño la eliminó o no tiene ninguna cita con el negocio.
 *     tags: [Clientes]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *       - { in: path, name: id_mascota, required: true, schema: { type: integer } }
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - { in: query, name: estado, schema: { type: string }, example: "completada,confirmada" }
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
 *                 data:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/CitaPanel'
 *                       - type: object
 *                         properties:
 *                           registros_medicos:
 *                             type: array
 *                             description: Registros médicos ligados a la cita (para "Vincular a una cita" de C4)
 *                             items: { $ref: '#/components/schemas/RegistroDeCita' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get(
  "/negocios/:id_negocio/mascotas/:id_mascota/citas",
  authMiddleware,
  validate({ params: citasMascotaParams, query: citasMascotaQuery }),
  authorizeAny([
    ["citas", "ver"],
    ["clientes", "ver"],
  ]),
  controller.getCitasMascota
);

export default router;
