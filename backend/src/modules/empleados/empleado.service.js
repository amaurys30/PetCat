import * as empleadoRepo from "./empleado.repository.js";
import * as rolRepo from "../roles/rol.repository.js";
import * as invitacionRepo from "../invitaciones/invitacion.repository.js";
import * as usuarioRepo from "../usuarios/usuario.repository.js";
import * as servicioRepo from "../servicios/servicio.repository.js";
import { citasFuturasDeEmpleado } from "../disponibilidad/disponibilidad.service.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { buildMeta } from "../../shared/utils/pagination.js";
import { permisosIncluidos } from "../../shared/utils/permissions.js";
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

/**
 * Prevención de escalada de privilegios. Solo aplica cuando quien actúa es un
 * empleado (req.acceso.relacion === "empleado"); el propietario y el admin de
 * plataforma no tienen límite.
 */
const esEmpleado = (acceso) => acceso?.relacion === "empleado";
const esElMismo = (empleado, acceso) => esEmpleado(acceso) && empleado.id_empleado === acceso.id_empleado;

/** No puede asignar un rol con permisos que su propio rol no tiene. */
const verificarRolAsignable = (rol, acceso) => {
  if (esEmpleado(acceso) && !permisosIncluidos(rol.permisos_json, acceso.permisos)) {
    throw ApiError.forbidden("No puedes asignar un rol con permisos que tu rol no tiene");
  }
};

/** No puede editar, desactivar ni reactivar a otro empleado con permisos que él no tiene. */
const verificarEmpleadoModificable = (empleado, acceso) => {
  if (!esEmpleado(acceso) || esElMismo(empleado, acceso)) return;
  if (!permisosIncluidos(empleado.permisos_json, acceso.permisos)) {
    throw ApiError.forbidden("No puedes modificar a un empleado con permisos que tu rol no tiene");
  }
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

/** Detalle: el rol con sus permisos y los servicios activos que atiende. */
export const getEmpleado = async (id_empleado) => {
  const empleado = await empleadoRepo.findById(id_empleado);
  if (!empleado) throw ApiError.notFound(NO_ENCONTRADO);
  const servicios = await servicioRepo.findActivosDeEmpleado(id_empleado);
  return { ...formatEmpleado(empleado, { conPermisos: true }), servicios };
};

export const createEmpleado = async (id_negocio, data, acceso) => {
  verificarRolAsignable(await findRolAsignable(data.id_rol, id_negocio), acceso);
  const id_empleado = await withTransaction(async (conn) => {
    await verificarEmailLibre(id_negocio, data.email, 0, conn);
    return empleadoRepo.create(id_negocio, data, conn);
  });
  return getEmpleado(id_empleado);
};

/**
 * El propietario se registra como empleado de su propio negocio, sin invitación
 * (en negocios pequeños el dueño también atiende y debe aparecer en la agenda).
 * Nombre, apellido y email salen de su cuenta; el rol por defecto es Administrador.
 * - Ya vinculado como empleado del negocio: 409.
 * - Existe un empleado sin cuenta con su email: lo vincula (y aplica los datos
 *   enviados) en lugar de crear otro; si ese empleado está inactivo, 409.
 * Devuelve { empleado, creado }.
 */
export const registrarPropietario = async (negocio, id_usuario, data) => {
  if (negocio.id_usuario_propietario !== id_usuario) {
    throw ApiError.forbidden("Solo el propietario puede registrarse como empleado de su negocio");
  }
  const rol =
    data.id_rol !== undefined
      ? await findRolAsignable(data.id_rol, negocio.id_negocio)
      : await rolRepo.findSistemaByNombre("Administrador");

  const { id_empleado, creado } = await withTransaction(async (conn) => {
    const vinculado = await empleadoRepo.findAccesoByUsuarioAndNegocio(id_usuario, negocio.id_negocio, conn);
    if (vinculado) {
      throw ApiError.conflict(
        vinculado.activo
          ? "Ya estás registrado como empleado de este negocio"
          : `Ya estás registrado como empleado de este negocio, pero inactivo (id_empleado ${vinculado.id_empleado}): reactívalo`
      );
    }

    const usuario = await usuarioRepo.findById(id_usuario, conn);
    const existente = await empleadoRepo.findByEmailInNegocio(negocio.id_negocio, usuario.email, 0, conn);
    if (existente) {
      if (existente.id_usuario) {
        throw ApiError.conflict("Hay un empleado del negocio con tu email vinculado a otra cuenta");
      }
      if (!existente.activo) {
        throw ApiError.conflict(
          `Hay un empleado inactivo con tu email (id_empleado ${existente.id_empleado}): reactívalo antes de vincularlo`
        );
      }
      await empleadoRepo.linkUsuario(existente.id_empleado, id_usuario, conn);
      await empleadoRepo.update(existente.id_empleado, data, conn);
      await invitacionRepo.invalidatePrevious(existente.id_empleado, conn);
      return { id_empleado: existente.id_empleado, creado: false };
    }

    const id = await empleadoRepo.create(
      negocio.id_negocio,
      { ...data, id_rol: rol.id_rol, nombre: usuario.nombre, apellido: usuario.apellido, email: usuario.email },
      conn
    );
    await empleadoRepo.linkUsuario(id, id_usuario, conn);
    return { id_empleado: id, creado: true };
  });

  return { empleado: await getEmpleado(id_empleado), creado };
};

/**
 * Cambiar el email invalida las invitaciones pendientes: iban al correo anterior.
 * Un empleado puede editar sus propios datos, pero no su rol.
 */
export const updateEmpleado = async (id_empleado, data, acceso) => {
  await withTransaction(async (conn) => {
    const empleado = await empleadoRepo.findById(id_empleado, conn);
    if (!empleado) throw ApiError.notFound(NO_ENCONTRADO);
    verificarEmpleadoModificable(empleado, acceso);

    if (data.id_rol !== undefined && data.id_rol !== empleado.id_rol) {
      if (esElMismo(empleado, acceso)) throw ApiError.forbidden("No puedes cambiar tu propio rol");
      verificarRolAsignable(await findRolAsignable(data.id_rol, empleado.id_negocio), acceso);
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
/**
 * Desactiva al empleado con su fila bloqueada (las reservas bloquean la misma fila) y
 * devuelve `citas_afectadas`: todas sus citas futuras pendientes o confirmadas, porque un
 * empleado inactivo no tiene disponibilidad. Hay que reasignarlas o reprogramarlas.
 */
export const desactivarEmpleado = async (id_empleado, acceso) => {
  const citas_afectadas = await withTransaction(async (conn) => {
    const empleado = await empleadoRepo.findById(id_empleado, conn, { forUpdate: true });
    if (!empleado) throw ApiError.notFound(NO_ENCONTRADO);
    if (!empleado.activo) throw ApiError.conflict("El empleado ya está inactivo");
    if (esElMismo(empleado, acceso)) throw ApiError.forbidden("No puedes desactivarte a ti mismo");
    verificarEmpleadoModificable(empleado, acceso);

    await empleadoRepo.desactivar(id_empleado, conn);
    await invitacionRepo.invalidatePrevious(id_empleado, conn);
    return citasFuturasDeEmpleado(id_empleado, conn);
  });
  return { empleado: await getEmpleado(id_empleado), citas_afectadas };
};

export const reactivarEmpleado = async (id_empleado, acceso) => {
  const empleado = await empleadoRepo.findById(id_empleado);
  if (!empleado) throw ApiError.notFound(NO_ENCONTRADO);
  if (empleado.activo) throw ApiError.conflict("El empleado ya está activo");
  verificarEmpleadoModificable(empleado, acceso);

  await empleadoRepo.reactivar(id_empleado);
  return getEmpleado(id_empleado);
};
