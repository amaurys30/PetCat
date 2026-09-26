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

/** Límite general para toda la API: 300 solicitudes cada 15 min por IP. */
export const generalLimiter = createLimiter(
  300,
  "Demasiadas solicitudes, intenta de nuevo en unos minutos"
);

/**
 * Límite estricto para endpoints sensibles a fuerza bruta (login, forgot-password,
 * invitaciones). Cada llamada crea un contador propio: usar una instancia por endpoint.
 */
export const strictLimiter = () =>
  createLimiter(
    env.AUTH_RATE_LIMIT_MAX,
    "Demasiados intentos, espera 15 minutos antes de volver a intentarlo"
  );
