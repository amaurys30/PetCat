import { ApiError } from "../errors/ApiError.js";
import { existePermiso, hasPermission } from "../utils/permissions.js";
import * as negocioRepo from "../../modules/negocios/negocio.repository.js";
import * as empleadoRepo from "../../modules/empleados/empleado.repository.js";

// Mensaje 404 de cada parámetro de ruta del que se puede deducir el negocio.
const RECURSO_NO_ENCONTRADO = {
  id_sucursal: "Sucursal no encontrada",
  id_empleado: "Empleado no encontrado",
  id_rol: "Rol no encontrado",
  id_servicio: "Servicio no encontrado",
  id_cita: "Cita no encontrada",
  id_producto: "Producto no encontrado",
  id_disponibilidad: "Disponibilidad no encontrada",
};

/**
 * id_negocio de la petición: de `:id_negocio` o, si no viene, del recurso de la
 * ruta (`:id_sucursal`, `:id_empleado`, `:id_rol`...). Nunca del body ni del query.
 * Devuelve null si el recurso existe pero es global (rol del sistema).
 */
const resolveIdNegocio = async (params) => {
  if (params.id_negocio !== undefined) return params.id_negocio;

  const param = negocioRepo.RECURSOS_CON_NEGOCIO.find((name) => params[name] !== undefined);
  if (!param) throw ApiError.internal("La ruta no indica a qué negocio pertenece el recurso");

  const recurso = await negocioRepo.findNegocioDeRecurso(param, params[param]);
  if (!recurso) throw ApiError.notFound(RECURSO_NO_ENCONTRADO[param]);
  return recurso.id_negocio;
};

// Error de programación: falla al cargar las rutas, no en la primera petición.
const verificarCatalogo = (permisos, llamada) => {
  for (const [modulo, accion] of permisos) {
    if (!existePermiso(modulo, accion)) {
      throw new Error(`${llamada}: permiso "${modulo}.${accion}" fuera de CATALOGO_PERMISOS`);
    }
  }
};

/**
 * Permite el acceso al panel de un negocio por pertenencia:
 * - admin de plataforma (`tipo_usuario = 'admin'`) y propietario del negocio: siempre;
 * - empleado activo vinculado a su cuenta: si su rol tiene `permisos_json[modulo]` con `accion`.
 * Va después de authMiddleware. Deja en la petición:
 *   req.negocio = fila del negocio (no existe para recursos globales)
 *   req.acceso  = { relacion: "admin" | "propietario" | "empleado", id_empleado?, id_rol?, permisos? }
 *
 *   router.patch("/:id_cita", authMiddleware, authorize("citas", "editar"), controller.update);
 */
export const authorize = (modulo, accion) => {
  verificarCatalogo([[modulo, accion]], `authorize("${modulo}", "${accion}")`);
  return authorizeMiddleware([[modulo, accion]]);
};

/**
 * Como authorize, pero el empleado pasa con **cualquiera** de los permisos. Con
 * `permitirSi(req, acceso)`, un empleado sin ninguno también pasa si la función
 * devuelve true (p. ej. ver su propia disponibilidad).
 *
 *   authorizeAny([["configuracion", "ver"], ["citas", "ver"]], {
 *     permitirSi: (req, acceso) => acceso.id_empleado === req.params.id_empleado,
 *   })
 */
export const authorizeAny = (permisos, { permitirSi } = {}) => {
  if (permisos.length === 0) throw new Error("authorizeAny: indica al menos un permiso");
  verificarCatalogo(permisos, "authorizeAny");
  return authorizeMiddleware(permisos, permitirSi);
};

/**
 * Resuelve el acceso al panel del negocio de la ruta. Deja `req.negocio` y
 * devuelve el acceso, o lanza 403/404 (ver authorize).
 */
const resolverAcceso = async (req, permisos, permitirSi) => {
  if (!req.user) throw ApiError.unauthorized("Token requerido");
  const { id_usuario, tipo_usuario } = req.user;
  const esAdmin = tipo_usuario === "admin";

  const id_negocio = await resolveIdNegocio(req.params);
  if (id_negocio === null) {
    // Recurso global (rol del sistema): solo el admin de plataforma.
    if (!esAdmin) throw ApiError.forbidden();
    return { relacion: "admin" };
  }

  const negocio = await negocioRepo.findById(id_negocio);
  if (!negocio) throw ApiError.notFound("Negocio no encontrado");
  req.negocio = negocio;

  if (esAdmin) return { relacion: "admin" };
  if (negocio.id_usuario_propietario === id_usuario) return { relacion: "propietario" };

  const empleado = await empleadoRepo.findAccesoByUsuarioAndNegocio(id_usuario, negocio.id_negocio);
  if (!empleado) throw ApiError.forbidden("No perteneces a este negocio");
  if (!empleado.activo) throw ApiError.forbidden("Tu acceso a este negocio está desactivado");

  const acceso = {
    relacion: "empleado",
    id_empleado: empleado.id_empleado,
    id_rol: empleado.id_rol,
    permisos: empleado.permisos_json,
  };
  const conPermiso = permisos.some(([modulo, accion]) => hasPermission(empleado.permisos_json, modulo, accion));
  if (!conPermiso && !permitirSi?.(req, acceso)) {
    throw ApiError.forbidden("No tienes permiso para realizar esta acción");
  }
  return acceso;
};

// eslint-disable-next-line no-unused-vars
const authorizeMiddleware = (permisos, permitirSi) => async (req, res, next) => {
  req.acceso = await resolverAcceso(req, permisos, permitirSi);
  next();
};

/**
 * Para recursos que usan el dueño (app) y el negocio (panel), como una cita:
 * - con acceso al panel del negocio del recurso y el permiso: `req.acceso` del panel;
 * - si no, y `esDueno(req)` es true: `req.acceso = { relacion: "dueno" }` (sin `req.negocio`);
 * - si no, 403. Un 404 del recurso o un 401 se propagan igual que en authorize.
 * Si es personal del negocio y además dueño, gana la vista del panel.
 *
 *   authorizeDuenoO("citas", "ver", { esDueno: (req) => citaEsDelUsuario(req.params.id_cita, req.user.id_usuario) })
 */
export const authorizeDuenoO = (modulo, accion, { esDueno }) => {
  verificarCatalogo([[modulo, accion]], `authorizeDuenoO("${modulo}", "${accion}")`);
  // eslint-disable-next-line no-unused-vars
  return async (req, res, next) => {
    try {
      req.acceso = await resolverAcceso(req, [[modulo, accion]]);
      return next();
    } catch (err) {
      if (err.status !== 403) throw err;
    }
    if (await esDueno(req)) {
      delete req.negocio;
      req.acceso = { relacion: "dueno" };
      return next();
    }
    throw ApiError.forbidden("No tienes acceso a este recurso");
  };
};

export default authorize;
