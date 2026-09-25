import { ApiError } from "../errors/ApiError.js";
import { hasPermission } from "../utils/permissions.js";
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
// eslint-disable-next-line no-unused-vars
export const authorize = (modulo, accion) => async (req, res, next) => {
  if (!req.user) throw ApiError.unauthorized("Token requerido");
  const { id_usuario, tipo_usuario } = req.user;
  const esAdmin = tipo_usuario === "admin";

  const id_negocio = await resolveIdNegocio(req.params);
  if (id_negocio === null) {
    // Recurso global (rol del sistema): solo el admin de plataforma.
    if (!esAdmin) throw ApiError.forbidden();
    req.acceso = { relacion: "admin" };
    return next();
  }

  const negocio = await negocioRepo.findById(id_negocio);
  if (!negocio) throw ApiError.notFound("Negocio no encontrado");
  req.negocio = negocio;

  if (esAdmin) {
    req.acceso = { relacion: "admin" };
    return next();
  }

  if (negocio.id_usuario_propietario === id_usuario) {
    req.acceso = { relacion: "propietario" };
    return next();
  }

  const empleado = await empleadoRepo.findAccesoByUsuarioAndNegocio(id_usuario, negocio.id_negocio);
  if (!empleado) throw ApiError.forbidden("No perteneces a este negocio");
  if (!empleado.activo) throw ApiError.forbidden("Tu acceso a este negocio está desactivado");

  if (!hasPermission(empleado.permisos_json, modulo, accion)) {
    throw ApiError.forbidden("No tienes permiso para realizar esta acción");
  }

  req.acceso = {
    relacion: "empleado",
    id_empleado: empleado.id_empleado,
    id_rol: empleado.id_rol,
    permisos: empleado.permisos_json,
  };
  next();
};

export default authorize;
