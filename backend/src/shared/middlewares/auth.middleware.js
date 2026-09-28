import { ApiError } from "../errors/ApiError.js";
import { verifyToken } from "../utils/jwt.js";
import { hashToken } from "../utils/hash.js";
import * as sessionRepo from "../../modules/sessions/session.repository.js";

/** Token de `Authorization: Bearer <token>`, o null si la cabecera falta o está mal formada. */
const bearerToken = (header) => {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  return match ? match[1] : null;
};

/**
 * Valida un access token: firma, sesión activa y vigente, y usuario activo. Devuelve
 * `{ user, session }` o lanza 401/403. La usan authMiddleware y el handshake de Socket.IO.
 */
export const autenticarToken = async (token) => {
  if (!token) throw ApiError.unauthorized("Token requerido");

  try {
    verifyToken(token);
  } catch (err) {
    throw ApiError.unauthorized(err.name === "TokenExpiredError" ? "Token expirado" : "Token inválido");
  }

  const session = await sessionRepo.findActiveByTokenHash(hashToken(token));
  if (!session) throw ApiError.unauthorized("Sesión inválida o expirada");
  if (!session.usuario_activo) throw ApiError.forbidden("La cuenta está desactivada");

  return {
    user: { id_usuario: session.id_usuario, email: session.email, tipo_usuario: session.tipo_usuario },
    session: { id_sesion: session.id_sesion, dispositivo: session.dispositivo, expira_en: session.expira_en },
  };
};

/**
 * Exige un access token válido con sesión activa y vigente de un usuario activo.
 * Deja en la petición:
 *   req.user    = { id_usuario, email, tipo_usuario }  (desde la base, no desde el token)
 *   req.session = { id_sesion, dispositivo, expira_en }
 * Los permisos sobre un negocio no se cargan aquí: los resuelve `authorize` por negocio.
 */
export const authMiddleware = async (req, res, next) => {
  const { user, session } = await autenticarToken(bearerToken(req.get("authorization")));
  req.user = user;
  req.session = session;
  next();
};

export default authMiddleware;
