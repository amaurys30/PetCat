import * as repo from "./auth.repository.js";
import { createSessionForUser } from "../sessions/session.service.js";
import { hashPassword, comparePassword } from "../../shared/utils/hash.js";

/**
 * REGISTRO
 */
export const register = async (data) => {
  const {
    nombre,
    apellido,
    email,
    password,
    tipo_usuario,
    telefono
  } = data;

  const userExists = await repo.findUserByEmail(email);
  if (userExists) throw new Error("Usuario ya existe");

  const password_hash = await hashPassword(password);

  const user = await repo.createUser({
    nombre,
    apellido,
    email,
    password_hash,
    tipo_usuario,
    telefono
  });

  return {
    id_usuario: user.id_usuario,
    nombre,
    apellido,
    email,
    tipo_usuario
  };
};

export const login = async (email, password) => {
  const user = await repo.findUserByEmail(email);
  if (!user) throw new Error("Usuario no encontrado");

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) throw new Error("Credenciales inválidas");

  return createSessionForUser(user);
};