import * as negocioRepo from "../negocios/negocio.repository.js";
import * as sucursalRepo from "./sucursal.repository.js";
import * as empleadoRepo from "../empleados/empleado.repository.js";
import * as rolRepo from "../roles/rol.repository.js";

export const createSucursal = async (id_usuario, id_negocio, data) => {

  // 1️⃣ Validar negocio
  const negocio = await negocioRepo.findById(id_negocio);

  if (!negocio) {
    const error = new Error("Negocio no encontrado");
    error.status = 404;
    throw error;
  }

  // 2️⃣ Validar propietario
  if (negocio.id_usuario_propietario !== id_usuario) {
    const error = new Error("No tienes permisos para este negocio");
    error.status = 403;
    throw error;
  }

  // 3️⃣ Validaciones básicas
  if (!data.nombre || !data.direccion) {
    const error = new Error("Nombre y dirección son obligatorios");
    error.status = 400;
    throw error;
  }


  // 4️⃣ Validar coordenadas
  if (data.latitud !== undefined && (data.latitud < -90 || data.latitud > 90)) {
    throw new Error("Latitud inválida");
  }

  if (data.longitud !== undefined && (data.longitud < -180 || data.longitud > 180)) {
    throw new Error("Longitud inválida");
  }

  if (
    (data.latitud !== undefined && data.longitud === undefined) ||
    (data.latitud === undefined && data.longitud !== undefined)
  ) {
    throw new Error("Debes enviar latitud y longitud juntas");
  }

  // 5️⃣ Si es principal, desactivar otras
  if (data.es_principal) {
    await sucursalRepo.clearPrincipal(id_negocio);
  }


  // 4️⃣ Crear sucursal
  return await sucursalRepo.createSucursal({
    ...data,
    id_negocio
  });
};

export const getSucursalesPublico = async (id_negocio) => {

  // 1️⃣ Validar que el negocio exista y esté activo
  const negocio = await negocioRepo.findById(id_negocio);

  if (!negocio || !negocio.activo) {
    const error = new Error("Negocio no encontrado");
    error.status = 404;
    throw error;
  }

  // 2️⃣ Obtener sucursales activas
  const sucursales = await sucursalRepo.findByNegocio(id_negocio);

  return sucursales;
};


export const updateSucursal = async (id_usuario, id_sucursal, data) => {

  // 1️⃣ Buscar sucursal
  const sucursal = await sucursalRepo.findById(id_sucursal);

  if (!sucursal) {
    const error = new Error("Sucursal no encontrada");
    error.status = 404;
    throw error;
  }

  // 2️⃣ Obtener negocio
  const negocio = await negocioRepo.findById(sucursal.id_negocio);

  // 3️⃣ Validar si es propietario
  const esPropietario = negocio.id_usuario_propietario === id_usuario;

  // 4️⃣ Validar si es empleado admin
  const empleado = await empleadoRepo.findByUserId(id_usuario);

  let esAdmin = false;

  if (empleado && empleado.id_negocio === sucursal.id_negocio) {
    const rol = await rolRepo.findById(empleado.id_rol);
    esAdmin = rol?.nombre === "Administrador";
  }

  if (!esPropietario && !esAdmin) {
    const error = new Error("No tienes permisos para editar esta sucursal");
    error.status = 403;
    throw error;
  }

  // 5️⃣ Validaciones
  if (data.latitud !== undefined && (data.latitud < -90 || data.latitud > 90)) {
    throw new Error("Latitud inválida");
  }

  if (data.longitud !== undefined && (data.longitud < -180 || data.longitud > 180)) {
    throw new Error("Longitud inválida");
  }

  if (
    (data.latitud !== undefined && data.longitud === undefined) ||
    (data.latitud === undefined && data.longitud !== undefined)
  ) {
    throw new Error("Debes enviar latitud y longitud juntas");
  }

  // 6️⃣ Manejo de sucursal principal
  if (data.es_principal === true) {
    await sucursalRepo.clearPrincipal(sucursal.id_negocio);
  }

  // 7️⃣ Actualizar
  await sucursalRepo.update(id_sucursal, data);

  return await sucursalRepo.findById(id_sucursal);
};

