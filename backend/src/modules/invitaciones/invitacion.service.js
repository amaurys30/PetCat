import crypto from "crypto";
import bcrypt from "bcrypt";
import * as invitacionRepo from "./invitacion.repository.js";
import * as userRepo from "../usuarios/usuario.repository.js";
import * as empleadoRepo from "../empleados/empleado.repository.js";

export const createInvitation = async (id_empleado, id_negocio) => {

  const empleado = await empleadoRepo.findById(id_empleado);

  if (!empleado) {
    const error = new Error("Empleado no encontrado");
    error.status = 404;
    throw error;
  }

  if (!empleado.email) {
    const error = new Error("El empleado no tiene email");
    error.status = 400;
    throw error;
  }

  //  invalidar anteriores
  await invitacionRepo.invalidatePrevious(id_empleado);

  const token = crypto.randomBytes(32).toString("hex");

  const expiracion = new Date();
  expiracion.setHours(expiracion.getHours() + 24);

  await invitacionRepo.create({
    id_empleado,
    id_negocio,
    email: empleado.email,
    token,
    expiracion
  });

  return {
    token,
    expiracion
  };
};

export const acceptInvitation = async (token, password, nombre, apellido) => {

  const invitacion = await invitacionRepo.findByToken(token);

  if (!invitacion) throw new Error("Invitación inválida");
  if (invitacion.usado) throw new Error("Invitación ya utilizada");
  if (new Date(invitacion.expiracion) < new Date()) {
    throw new Error("Invitación expirada");
  }

  let usuario = await userRepo.findByEmail(invitacion.email);

  // 🟢 CASO 1: YA EXISTE
  if (usuario) {

    await empleadoRepo.update(invitacion.id_empleado, {
      id_usuario: usuario.id_usuario
    });

  } else {

    // 🔴 VALIDAR DATOS OBLIGATORIOS
    if (!password || !nombre || !apellido) {
      throw new Error("Nombre, apellido y contraseña son obligatorios");
    }

    const hashed = await bcrypt.hash(password, 10);

    const userId = await userRepo.create({
      nombre,
      apellido,
      email: invitacion.email,
      password_hash: hashed
    });

    await empleadoRepo.update(invitacion.id_empleado, {
      id_usuario: userId
    });
  }

  await invitacionRepo.markAsUsed(invitacion.id_invitacion);

  return true;
};

