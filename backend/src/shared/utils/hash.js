import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";

/**
 * Genera hash de password
 */
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

/**
 * Compara password con hash
 */
export const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

/**
 * SHA-256 en hexadecimal (64 caracteres). Para tokens que se guardan en la base
 * (sesiones, invitaciones): la base nunca guarda el token en claro y se busca por el hash.
 */
export const hashToken = (token) => createHash("sha256").update(token).digest("hex");
