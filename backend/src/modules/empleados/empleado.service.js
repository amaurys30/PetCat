import * as negocioRepo from "../negocios/negocio.repository.js";
import * as empleadoRepo from "./empleado.repository.js";
import * as rolRepo from "../roles/rol.repository.js";
import * as userRepo from "../usuarios/usuario.repository.js";

export const createEmpleado = async (id_usuario, id_negocio, data) => {

  // 1️⃣ Validar negocio
  const negocio = await negocioRepo.findById(id_negocio);

  if (!negocio) {
    const error = new Error("Negocio no encontrado");
    error.status = 404;
    throw error;
  }

  // ⚠️ IMPORTANTE:
  // ❌ NO validamos permisos aquí
  // ✔ Ya se validaron en authorize()

  // 2️⃣ Validar rol
  const rol = await rolRepo.findById(data.id_rol);

  if (!rol) {
    const error = new Error("Rol no válido");
    error.status = 400;
    throw error;
  }

  // 3️⃣ Validaciones obligatorias
  if (!data.nombre || !data.apellido || !data.fecha_vinculacion) {
    const error = new Error("Nombre, apellido y fecha de vinculación son obligatorios");
    error.status = 400;
    throw error;
  }

  // 4️⃣ Validar email formato
  if (data.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(data.email)) {
      const error = new Error("Email inválido");
      error.status = 400;
      throw error;
    }
  }

  // 5️⃣ Validar duplicados
  if (data.email) {
    const existente = await empleadoRepo.findByEmail(data.email);

    if (existente) {
      const error = new Error("Ya existe un empleado con este email");
      error.status = 400;
      throw error;
    }
  }

  // 6️⃣ Validar fecha
  const fecha = new Date(data.fecha_vinculacion);

  if (isNaN(fecha.getTime())) {
    const error = new Error("Fecha de vinculación inválida");
    error.status = 400;
    throw error;
  }

  // 7️⃣ Crear empleado
  return await empleadoRepo.create({
    ...data,
    id_negocio
  });
};


export const getEmpleadosByNegocio = async (id_negocio) => {

  // 1️⃣ Validar negocio
  const negocio = await negocioRepo.findById(id_negocio);

  if (!negocio) {
    const error = new Error("Negocio no encontrado");
    error.status = 404;
    throw error;
  }

  // ⚠️ NO validamos permisos aquí
  // ✔ authorize() ya lo hizo

  // 2️⃣ Obtener empleados (activos e inactivos)
  const empleados = await empleadoRepo.findAllByNegocio(id_negocio);

  if (!empleados || empleados.length === 0) {
    return [];
  }

  return empleados;
};

export const updateEmpleado = async (user, id_empleado, data) => {

  // 1️⃣ Validar ID
  if (!id_empleado || isNaN(id_empleado)) {
    const error = new Error("ID de empleado inválido");
    error.status = 400;
    throw error;
  }

  // 2️⃣ Buscar empleado
  const empleado = await empleadoRepo.findById(id_empleado);

  if (!empleado) {
    const error = new Error("Empleado no encontrado");
    error.status = 404;
    throw error;
  }

  // 3️⃣ Validar negocio
  const negocio = await negocioRepo.findById(empleado.id_negocio);

  if (!negocio) {
    const error = new Error("Negocio no encontrado");
    error.status = 404;
    throw error;
  }

  // 4️⃣ Validar propietario
  const esPropietario = negocio.id_usuario_propietario === user.id_usuario;

  let tienePermiso = esPropietario;

  // 5️⃣ Validar admin por permisos_json (authorize ya ayuda, pero reforzamos)
  if (!tienePermiso) {
    const emp = await empleadoRepo.findByUserAndNegocio(
      user.id_usuario,
      negocio.id_negocio
    );

    if (emp) {
      const rol = await rolRepo.findById(emp.id_rol);

      const allowed = hasPermission(
        rol.permisos_json,
        "empleados",
        "editar"
      );

      if (allowed) {
        tienePermiso = true;
      }
    }
  }

  if (!tienePermiso) {
    const error = new Error("No tienes permisos para editar este empleado");
    error.status = 403;
    throw error;
  }

  // 6️⃣ Validar rol (si se envía)
  if (data.id_rol) {
    const rol = await rolRepo.findById(data.id_rol);

    if (!rol) {
      const error = new Error("Rol no válido");
      error.status = 400;
      throw error;
    }
  }

  // 7️⃣ Validar usuario (si se quiere vincular)
  if (data.id_usuario) {
    const userExist = await userRepo.findById(data.id_usuario);

    if (!userExist) {
      const error = new Error("Usuario no existe");
      error.status = 404;
      throw error;
    }

    // evitar duplicidad
    const yaAsignado = await empleadoRepo.findByUserId(data.id_usuario);

    if (yaAsignado && yaAsignado.id_empleado != id_empleado) {
      const error = new Error("Este usuario ya está asignado a otro empleado");
      error.status = 400;
      throw error;
    }
  }

  // 8️⃣ Validar email único (si se cambia)
  if (data.email) {
    const existente = await empleadoRepo.findByEmail(data.email);

    if (existente && existente.id_empleado != id_empleado) {
      const error = new Error("Ya existe un empleado con este email");
      error.status = 400;
      throw error;
    }
  }

  // 9️⃣ Validar campos vacíos opcionalmente
  if (data.nombre !== undefined && data.nombre.trim() === "") {
    throw new Error("Nombre no puede estar vacío");
  }

  if (data.apellido !== undefined && data.apellido.trim() === "") {
    throw new Error("Apellido no puede estar vacío");
  }

  // 🔟 Actualizar
  const updated = await empleadoRepo.update(id_empleado, data);

  return updated;
};


export const deleteEmpleado = async (id_usuario, id_empleado) => {

  // 1️⃣ Buscar empleado
  const empleado = await empleadoRepo.findById(id_empleado);

  if (!empleado) {
    const error = new Error("Empleado no encontrado");
    error.status = 404;
    throw error;
  }

  // 2️⃣ Validar si ya está inactivo
  if (!empleado.activo) {
    const error = new Error("El empleado ya se encuentra desactivado");
    error.status = 400;
    throw error;
  }

  // 3️⃣ Evitar auto-desactivación
  if (empleado.id_usuario === id_usuario) {
    const error = new Error("No puedes desactivarte a ti mismo");
    error.status = 400;
    throw error;
  }

  // 4️⃣ Soft delete
  await empleadoRepo.softDelete(id_empleado);

  // 5️⃣ Retornar actualizado
  return await empleadoRepo.findById(id_empleado);
};

export const reactivarEmpleado = async (id_empleado) => {

  // 1️⃣ Buscar empleado
  const empleado = await empleadoRepo.findById(id_empleado);

  if (!empleado) {
    const error = new Error("Empleado no encontrado");
    error.status = 404;
    throw error;
  }

  // 2️⃣ Validar si ya está activo
  if (empleado.activo) {
    const error = new Error("El empleado ya se encuentra activo");
    error.status = 400;
    throw error;
  }

  // 3️⃣ Reactivar
  await empleadoRepo.reactivar(id_empleado);

  // 4️⃣ Retornar actualizado
  return await empleadoRepo.findById(id_empleado);
};