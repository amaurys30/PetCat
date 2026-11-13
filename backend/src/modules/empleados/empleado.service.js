import * as empleadoRepo from "./empleado.repository.js";
import * as rolRepo from "../roles/rol.repository.js";
import * as invitacionRepo from "../invitaciones/invitacion.repository.js";
import * as usuarioRepo from "../usuarios/usuario.repository.js";
import * as servicioRepo from "../servicios/servicio.repository.js";
import { bloquearYVerificarLimite } from "../suscripciones/suscripcion.service.js";
import { citasFuturasDeEmpleado } from "../disponibilidad/disponibilidad.service.js";
import { avisarAgenda } from "../citas/agenda.tiempoReal.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { buildMeta } from "../../shared/utils/pagination.js";
import { hasPermission, permisosIncluidos } from "../../shared/utils/permissions.js";
import { MAX_CORREOS, VENTANA_HORAS } from "../invitaciones/invitacion.service.js";
import { ApiError } from "../../shared/errors/ApiError.js";
import { conMiniaturas } from "../../shared/utils/storage.js";
import { quitarImagen, reemplazarImagen } from "../archivos/archivo.service.js";

const NO_ENCONTRADO = "Empleado no encontrado";

/**
 * Estado de la invitación para el panel. null si no se le puede invitar (tiene cuenta,
 * no tiene email o está inactivo). `libre_desde` solo cuando ya no quedan envíos.
 */
const formatInvitacion = (row, estado) => {
  if (row.id_usuario !== null || !row.email || !row.activo) return null;
  const restantes = Math.max(0, MAX_CORREOS - Number(estado?.enviadas ?? 0));
  return {
    expiracion: estado?.expiracion ?? null,
    envios_restantes_24h: restantes,
    libre_desde: restantes === 0 ? estado.libre_desde : null,
  };
};

/**
 * Formato de salida con los servicios activos que atiende y el estado de la invitación.
 * En el detalle el rol incluye sus permisos; en el listado, no.
 */
const formatEmpleados = async (rows, { conPermisos = false } = {}) => {
  const ids = rows.map((row) => row.id_empleado);
  const [servicios, invitaciones] = await Promise.all([
    servicioRepo.findActivosDeEmpleados(ids),
    invitacionRepo.findEstadoDeEmpleados(ids, VENTANA_HORAS),
  ]);
  return rows.map((row) => {
    const { id_rol, rol_nombre, permisos_json, activo, invitacion_pendiente, es_propietario, ...empleado } = row;
    return {
      ...conMiniaturas(empleado),
      activo: Boolean(activo),
      es_propietario: Boolean(es_propietario),
      tiene_cuenta: empleado.id_usuario !== null,
      invitacion_pendiente: Boolean(invitacion_pendiente),
      invitacion: formatInvitacion(row, invitaciones[row.id_empleado]),
      rol: { id_rol, nombre: rol_nombre, ...(conPermisos && { permisos_json }) },
      servicios: servicios[row.id_empleado] ?? [],
    };
  });
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
  return { rows: await formatEmpleados(rows), meta: buildMeta(total, page, limit) };
};

/**
 * Profesionales para la agenda (citas.ver): empleados activos sin datos de contacto ni
 * de la invitación, con los servicios activos que atienden.
 */
export const getProfesionales = async (id_negocio) => {
  const rows = await empleadoRepo.findProfesionales(id_negocio);
  const servicios = await servicioRepo.findActivosDeEmpleados(rows.map((row) => row.id_empleado));
  return rows.map(({ id_rol, rol_nombre, ...empleado }) => ({
    ...conMiniaturas(empleado),
    rol: { id_rol, nombre: rol_nombre },
    servicios: servicios[empleado.id_empleado] ?? [],
  }));
};

/** Detalle: el rol con sus permisos y los servicios activos que atiende. */
export const getEmpleado = async (id_empleado) => {
  const empleado = await empleadoRepo.findById(id_empleado);
  if (!empleado) throw ApiError.notFound(NO_ENCONTRADO);
  return (await formatEmpleados([empleado], { conPermisos: true }))[0];
};

/**
 * Asignar servicios desde el empleado cambia si esos servicios se pueden reservar:
 * exige `servicios.editar`, igual que asignar empleados desde el servicio.
 */
const verificarPuedeAsignarServicios = (data, acceso) => {
  if (data.servicios === undefined || !esEmpleado(acceso)) return;
  if (!hasPermission(acceso.permisos, "servicios", "editar")) {
    throw ApiError.forbidden("Para asignar servicios necesitas el permiso de editar servicios");
  }
};

/** Reemplaza los servicios activos del empleado; 422 si alguno no es un servicio activo del negocio. */
const asignarServicios = async (id_empleado, id_negocio, servicios, conn) => {
  const invalidos = await servicioRepo.replaceServiciosActivosDeEmpleado(id_empleado, id_negocio, servicios, conn);
  if (invalidos.length > 0) {
    throw ApiError.unprocessable("Datos inválidos", {
      servicios: `No son servicios activos del negocio: ${invalidos.join(", ")}`,
    });
  }
};

export const createEmpleado = async (id_negocio, data, acceso) => {
  verificarRolAsignable(await findRolAsignable(data.id_rol, id_negocio), acceso);
  verificarPuedeAsignarServicios(data, acceso);
  const id_empleado = await withTransaction(async (conn) => {
    await bloquearYVerificarLimite(id_negocio, "empleados", conn);
    await verificarEmailLibre(id_negocio, data.email, 0, conn);
    const id = await empleadoRepo.create(id_negocio, data, conn);
    if (data.servicios?.length) await asignarServicios(id, id_negocio, data.servicios, conn);
    return id;
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
  verificarPuedeAsignarServicios(data, acceso);
  await withTransaction(async (conn) => {
    const empleado = await empleadoRepo.findById(id_empleado, conn);
    if (!empleado) throw ApiError.notFound(NO_ENCONTRADO);
    verificarEmpleadoModificable(empleado, acceso);
    if (data.servicios !== undefined && !empleado.activo) {
      throw ApiError.conflict("El empleado está inactivo: reactívalo antes de asignarle servicios");
    }

    if (data.id_rol !== undefined && data.id_rol !== empleado.id_rol) {
      if (esElMismo(empleado, acceso)) throw ApiError.forbidden("No puedes cambiar tu propio rol");
      verificarRolAsignable(await findRolAsignable(data.id_rol, empleado.id_negocio), acceso);
    }

    // Servicios antes que la fila del empleado: la reserva bloquea servicio y luego empleado,
    // y el orden inverso podría cruzarse con ella en un deadlock.
    if (data.servicios !== undefined) await asignarServicios(id_empleado, empleado.id_negocio, data.servicios, conn);

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
export const desactivarEmpleado = async (id_empleado, acceso, por = null) => {
  let id_negocio;
  const citas_afectadas = await withTransaction(async (conn) => {
    const empleado = await empleadoRepo.findById(id_empleado, conn, { forUpdate: true });
    id_negocio = empleado?.id_negocio;
    if (!empleado) throw ApiError.notFound(NO_ENCONTRADO);
    if (!empleado.activo) throw ApiError.conflict("El empleado ya está inactivo");
    if (esElMismo(empleado, acceso)) throw ApiError.forbidden("No puedes desactivarte a ti mismo");
    verificarEmpleadoModificable(empleado, acceso);

    await empleadoRepo.desactivar(id_empleado, conn);
    await invitacionRepo.invalidatePrevious(id_empleado, conn);
    return citasFuturasDeEmpleado(id_empleado, conn);
  });
  await avisarAgenda(id_negocio, { accion: "disponibilidad", id_empleado, por }, { empleados: [id_empleado] });
  return { empleado: await getEmpleado(id_empleado), citas_afectadas };
};

/**
 * Reactivar cuenta para el límite de empleados del plan, salvo que sea el propietario
 * registrado como empleado de su negocio (no ocupa cupo).
 */
export const reactivarEmpleado = async (id_empleado, acceso, por = null) => {
  const empleado = await empleadoRepo.findById(id_empleado);
  if (!empleado) throw ApiError.notFound(NO_ENCONTRADO);
  if (empleado.activo) throw ApiError.conflict("El empleado ya está activo");
  verificarEmpleadoModificable(empleado, acceso);

  await withTransaction(async (conn) => {
    if (!empleado.es_propietario) await bloquearYVerificarLimite(empleado.id_negocio, "empleados", conn);
    await empleadoRepo.reactivar(id_empleado, conn);
  });
  await avisarAgenda(empleado.id_negocio, { accion: "disponibilidad", id_empleado, por }, { empleados: [id_empleado] });
  return getEmpleado(id_empleado);
};

// ---------- Foto ----------

/** Empleado existente que quien actúa puede modificar (reglas de escalada); 404 si no existe. */
const findModificable = async (id_empleado, acceso, conn, opciones) => {
  const empleado = await empleadoRepo.findById(id_empleado, conn, opciones);
  if (!empleado) throw ApiError.notFound(NO_ENCONTRADO);
  verificarEmpleadoModificable(empleado, acceso);
  return empleado;
};

/**
 * Foto del empleado: con `empleados.editar` (y las reglas de escalada) o el propio
 * empleado. Se comprueba antes de subir y otra vez con el empleado bloqueado.
 */
const fotoDeEmpleado = (id_empleado, acceso, id_usuario) => ({
  entidad: "empleado_foto",
  id_entidad: id_empleado,
  id_usuario,
  bloquear: async (conn) => (await findModificable(id_empleado, acceso, conn, { forUpdate: true })).foto_url,
  guardarUrl: (conn, url) => empleadoRepo.setFoto(id_empleado, url, conn),
});

export const subirFoto = async (id_empleado, acceso, id_usuario, archivo) => {
  await findModificable(id_empleado, acceso);
  await reemplazarImagen({ ...fotoDeEmpleado(id_empleado, acceso, id_usuario), archivo });
  return getEmpleado(id_empleado);
};

export const eliminarFoto = async (id_empleado, acceso, id_usuario) => {
  await quitarImagen({ ...fotoDeEmpleado(id_empleado, acceso, id_usuario), sinImagen: "El empleado no tiene foto" });
  return getEmpleado(id_empleado);
};
