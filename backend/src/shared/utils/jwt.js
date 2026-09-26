import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

/**
 * Generar Access Token
 */
export const generateToken = (payload) => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
};

/**
 * Verificar Access Token. Lanza TokenExpiredError o JsonWebTokenError.
 */
export const verifyToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
};
