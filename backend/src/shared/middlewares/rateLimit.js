import { rateLimit } from "express-rate-limit";
import { env, isTest } from "../../config/env.js";
import { sendError } from "../utils/response.js";

const WINDOW_MS = 15 * 60 * 1000;

const createLimiter = (limit, message) =>
  rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Los tests hacen muchas solicitudes seguidas desde la misma IP.
    skip: () => isTest,
    handler: (req, res) => sendError(res, 429, message),
  });

/** Límite general para toda la API: RATE_LIMIT_MAX solicitudes cada 15 min por IP (300 por defecto). */
export const generalLimiter = createLimiter(
  env.RATE_LIMIT_MAX,
  "Demasiadas solicitudes, intenta de nuevo en unos minutos"
);

/**
 * Subidas de archivos: 30 cada 15 min por usuario (un solo contador para todas las
 * rutas de subida). Va después de authMiddleware: la clave es el id del usuario.
 */
export const uploadLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => `usuario:${req.user.id_usuario}`,
  skip: () => isTest,
  handler: (req, res) => sendError(res, 429, "Demasiadas subidas de archivos, espera unos minutos"),
});

/**
 * Límite estricto para endpoints sensibles a fuerza bruta (login, recuperación y verificación de cuenta,
 * invitaciones). Cada llamada crea un contador propio: usar una instancia por endpoint.
 */
export const strictLimiter = () =>
  createLimiter(
    env.AUTH_RATE_LIMIT_MAX,
    "Demasiados intentos, espera 15 minutos antes de volver a intentarlo"
  );
