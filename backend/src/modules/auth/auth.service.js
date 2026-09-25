import * as repo from "./auth.repository.js";
import * as sessionRepo from "../sessions/session.repository.js";
import { hashPassword, comparePassword } from "../../shared/utils/hash.js";
import { generateToken } from "../../shared/utils/jwt.js";
import { generateRefreshToken } from "../../shared/utils/tokens.js";

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

  // 🔐 payload único (importante para auth real)
  const payload = {
    id_usuario: user.id_usuario,
    email: user.email,
    tipo_usuario: user.tipo_usuario
  };

  // 🔑 Access Token (corto)
  const token = generateToken(payload);

  // 🔄 Refresh Token (largo)
  const refreshToken = generateRefreshToken(payload);

  await sessionRepo.createSession({
    id_usuario: user.id_usuario,
    token,
    refresh_token: refreshToken,
    dispositivo: "web",
    ip_address: "unknown",
    user_agent: "swagger",
    expira_en: new Date(Date.now() + 60 * 60 * 1000) // 1h
  });

  return {
    token,
    refreshToken,
    user: {
      id_usuario: user.id_usuario,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      tipo_usuario: user.tipo_usuario
    }
  };
};