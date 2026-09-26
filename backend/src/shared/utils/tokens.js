import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

/**
 * Generar Refresh Token
 */
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, env.REFRESH_SECRET, {
    expiresIn: env.REFRESH_EXPIRES_IN,
  });
};

/**
 * Verificar Refresh Token
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, env.REFRESH_SECRET, { algorithms: ["HS256"] });
};
