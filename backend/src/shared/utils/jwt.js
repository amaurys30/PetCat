import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "petcat_secret_key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

/**
 * Generar Access Token
 */
export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

/**
 * Verificar Access Token
 */
export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};