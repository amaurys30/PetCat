import * as empleadoRepo from "./empleado.repository.js";
import * as rolRepo from "../roles/rol.repository.js";
import * as invitacionRepo from "../invitaciones/invitacion.repository.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { buildMeta } from "../../shared/utils/pagination.js";
import { ApiError } from "../../shared/errors/ApiError.js";

const NO_ENCONTRADO = "Empleado no encontrado";

/**
 * Formato de salida. En el detalle el rol incluye sus permisos; en el listado, no.
 */
const formatEmpleado = (row, { conPermisos = false } = {}) => {
  const { id_rol, rol_nombre, permisos_json, activo, invitacion_pendiente, ...empleado } = row;
  return {
    ...empleado,
    activo: Boolean(activo),
    tiene_cuenta: empleado.id_usuario !== null,
    invitacion_pendiente: Boolean(invitacion_pendiente),
    rol: { id_rol, nombre: rol_nombre, ...(conPermisos && { permisos_json }) },
  };
};

const mismoEmail = (a, b) => (a ?? "").toLowerCase() === (b ?? "").toLowerCase();

/** El rol debe ser del sistema o del mismo negocio. */
const findRolAsignable = async (id_rol, id_negocio) => {
  const rol = await rolRepo.findById(id_rol);
  if (!rol || (rol.id_negocio !== null && rol.id_negocio !== id_negocio)) {
    throw ApiError.unprocessable("Datos inválidos", { id_rol: "El rol no existe en este negocio" });
  }
  return rol;
};

/** Email único en el negocio. Si lo tiene un empleado inactivo, el 409 indica que se puede reactivar. */
const verificarEmailLibre = async (id_negocio, email, excluirId, conn) => {
  if (!email) return;
  const existente = await empleadoRepo.findByEmailInNegocio(id_negocio, email, excluirId, conn);
  if (!existente) return;
  if (!existente.activo) {
    throw ApiError.conflict(
      `Ese email pertenece a un empleado inactivo del negocio (id_empleado ${existente.id_empleado}): puedes reactivarlo en lugar de crear otro`,
      { email: `Pertenece a un empleado inactivo que se puede reactivar: PATCH /empleados/${existente.id_empleado}/reactivar` }
    );
  }
  throw ApiError.conflict("Ya existe un empleado con ese email en el negocio", { email: "Ya está en uso" });
};

export const getEmpleados = async (id_negocio, { page, limit, activo, q }) => {
  const { rows, total } = await empleadoRepo.findPageByNegocio(id_negocio, {
    activo,
    q,
    limit,
    offset: (page - 1) * limit,
  });
  return { rows: rows.map((row) => formatEmpleado(row)), meta: buildMeta(total, page, limit) };
};

export const getEmpleado = async (id_empleado) => {
  const empleado = await empleadoRepo.findById(id_empleado);
  if (!empleado) throw ApiError.notFound(NO_ENCONTRADO);
  return formatEmpleado(empleado, { conPermisos: true });
};

export const createEmpleado = async (id_negocio, data) => {
  await findRolAsignable(data.id_rol, id_negocio);
  const id_empleado = await withTransaction(async (conn) => {
    await verificarEmailLibre(id_negocio, data.email, 0, conn);
    return empleadoRepo.create(id_negocio, data, conn);
  });
  return getEmpleado(id_empleado);
};

/**
 * Cambiar el email invalida las invitaciones pendientes: iban al correo anterior.
 */
export const updateEmpleado = async (id_empleado, data) => {
  await withTransaction(async (conn) => {
    const empleado = await empleadoRepo.findById(id_empleado, conn);
    if (!empleado) throw ApiError.notFound(NO_ENCONTRADO);

    if (data.id_rol !== undefined && data.id_rol !== empleado.id_rol) {
      await findRolAsignable(data.id_rol, empleado.id_negocio);
    }

    const cambiaEmail = data.email !== undefined && !mismoEmail(data.email, empleado.email);
    if (cambiaEmail) {
      await verificarEmailLibre(empleado.id_negocio, data.email, id_empleado, conn);
      await invitacionRepo.invalidatePrevious(id_empleado, conn);
    }

    await empleadoRepo.update(id_empleado, data, conn);
  });
  return getEmpleado(id_empleado);
};

/** Borrado lógico: activo = FALSE, fecha_retiro = hoy e invitaciones pendientes invalidadas. */
export const desactivarEmpleado = async (id_empleado) => {
  await withTransaction(async (conn) => {
    const empleado = await empleadoRepo.findById(id_empleado, conn);
    if (!empleado) throw ApiError.notFound(NO_ENCONTRADO);
    if (!empleado.activo) throw ApiError.conflict("El empleado ya está inactivo");

    await empleadoRepo.desactivar(id_empleado, conn);
    await invitacionRepo.invalidatePrevious(id_empleado, conn);
  });
  return getEmpleado(id_empleado);
};

export const reactivarEmpleado = async (id_empleado) => {
  const empleado = await empleadoRepo.findById(id_empleado);
  if (!empleado) throw ApiError.notFound(NO_ENCONTRADO);
  if (empleado.activo) throw ApiError.conflict("El empleado ya está activo");

  await empleadoRepo.reactivar(id_empleado);
  return getEmpleado(id_empleado);
};
