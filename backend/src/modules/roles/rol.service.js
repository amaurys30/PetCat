import * as rolRepo from "./rol.repository.js";
import { permisosIncluidos } from "../../shared/utils/permissions.js";
import { castFields } from "../../shared/utils/format.js";
import { ApiError } from "../../shared/errors/ApiError.js";

const formatRol = (rol) =>
  castFields(rol, { bools: ["es_sistema"], numbers: ["empleados_activos", "empleados_inactivos"] });

const empleadosTexto = (n, adjetivo) => `${n} ${n === 1 ? `empleado ${adjetivo}` : `empleados ${adjetivo}s`}`;

const verificarNombre = async (nombre, id_negocio, id_rol) => {
  if (await rolRepo.existsNombre(nombre, id_negocio, id_rol)) {
    throw ApiError.conflict("Ya existe un rol con ese nombre en el negocio o entre los roles del sistema", {
      nombre: "Nombre en uso",
    });
  }
};

/**
 * Prevención de escalada de privilegios. Solo aplica a empleados: el propietario
 * y el admin de plataforma no tienen límite. Un empleado no puede otorgar
 * permisos que su rol no tiene, ni tocar su propio rol, ni tocar un rol con
 * permisos que él no tiene.
 */
const esEmpleado = (acceso) => acceso?.relacion === "empleado";

const verificarPermisosOtorgados = (acceso, permisos) => {
  if (esEmpleado(acceso) && !permisosIncluidos(permisos, acceso.permisos)) {
    throw ApiError.forbidden("No puedes otorgar permisos que tu rol no tiene");
  }
};

const verificarRolModificable = (rol, acceso) => {
  if (rol.es_sistema) throw ApiError.forbidden("Los roles del sistema no se pueden modificar ni eliminar");
  if (!esEmpleado(acceso)) return;
  if (rol.id_rol === acceso.id_rol) throw ApiError.forbidden("No puedes modificar tu propio rol");
  if (!permisosIncluidos(rol.permisos_json, acceso.permisos)) {
    throw ApiError.forbidden("No puedes modificar un rol con permisos que tu rol no tiene");
  }
};

export const getRoles = async (id_negocio) => {
  const roles = await rolRepo.findByNegocio(id_negocio);
  return roles.map(formatRol);
};

export const createRol = async (id_negocio, data, acceso) => {
  verificarPermisosOtorgados(acceso, data.permisos_json);
  await verificarNombre(data.nombre, id_negocio);
  const id_rol = await rolRepo.create(id_negocio, data);
  return formatRol(await rolRepo.findById(id_rol));
};

/** authorize ya comprobó que el rol existe y es del negocio (o que es admin). */
export const updateRol = async (id_rol, data, acceso) => {
  const rol = await rolRepo.findById(id_rol);
  verificarRolModificable(rol, acceso);
  if (data.permisos_json) verificarPermisosOtorgados(acceso, data.permisos_json);
  if (data.nombre) await verificarNombre(data.nombre, rol.id_negocio, id_rol);

  await rolRepo.update(id_rol, data);
  return formatRol(await rolRepo.findById(id_rol));
};

export const deleteRol = async (id_rol, acceso) => {
  const rol = await rolRepo.findById(id_rol);
  verificarRolModificable(rol, acceso);

  // Los inactivos también lo impiden: conservan el rol por si se reactivan.
  const { activos, inactivos } = await rolRepo.countEmpleados(id_rol);
  if (activos + inactivos > 0) {
    const partes = [activos && empleadosTexto(activos, "activo"), inactivos && empleadosTexto(inactivos, "inactivo")];
    const quienes = partes.filter(Boolean).join(" y ");
    throw ApiError.conflict(
      inactivos > 0
        ? `Hay ${quienes} con este rol: cámbiales el rol antes de eliminarlo, también a los inactivos`
        : `Hay ${quienes} con este rol: asígnales otro antes de eliminarlo`
    );
  }
  await rolRepo.remove(id_rol);
};
