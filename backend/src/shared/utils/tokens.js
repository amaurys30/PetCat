import jwt from "jsonwebtoken";

const REFRESH_SECRET = process.env.REFRESH_SECRET || "petcat_refresh_secret";
const REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN || "7d";

/**
 * Generar Refresh Token
 */
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
  });
};

/**
 * Verificar Refresh Token
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_SECRET);
};
