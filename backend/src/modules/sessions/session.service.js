import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import * as sessionRepo from "./session.repository.js";
import * as usuarioRepo from "../usuarios/usuario.repository.js";
import { generateToken } from "../../shared/utils/jwt.js";
import { generateRefreshToken, verifyRefreshToken } from "../../shared/utils/tokens.js";
import { hashToken } from "../../shared/utils/hash.js";
import { usuarioPublico } from "../../shared/utils/sanitize.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { ApiError } from "../../shared/errors/ApiError.js";

/**
 * Firma un access token y un refresh token nuevos. Cada uno lleva un jti
 * distinto: dos sesiones creadas en el mismo segundo no generan el mismo hash.
 * `expira_en_unix` es el vencimiento del refresh token, que es el de la sesión.
 */
const firmarTokens = (usuario) => {
  const payload = {
    id_usuario: usuario.id_usuario,
    email: usuario.email,
    tipo_usuario: usuario.tipo_usuario,
  };
  const access_token = generateToken({ ...payload, jti: randomUUID() });
  const refresh_token = generateRefreshToken({ ...payload, jti: randomUUID() });
  const { exp } = jwt.decode(refresh_token);
  return { access_token, refresh_token, expira_en_unix: exp };
};

/**
 * Inicia sesión para un usuario ya autenticado: firma access y refresh token,
 * guarda sus hashes en `sesiones` y devuelve la respuesta de login.
 * La usan el login y la aceptación de invitaciones (auto-login).
 *
 * @param {object} usuario  Fila de `usuarios` (al menos id_usuario, email, tipo_usuario)
 * @param {{ ip?: string, userAgent?: string, dispositivo?: string }} [cliente]
 * @param {import("mysql2/promise").PoolConnection} [conn] Para usarla dentro de una transacción
 * @returns {Promise<{ access_token: string, refresh_token: string, usuario: object }>}
 */
export const createSessionForUser = async (usuario, cliente = {}, conn) => {
  const { access_token, refresh_token, expira_en_unix } = firmarTokens(usuario);

  await sessionRepo.create(
    {
      id_usuario: usuario.id_usuario,
      token_hash: hashToken(access_token),
      refresh_token_hash: hashToken(refresh_token),
      dispositivo: cliente.dispositivo ?? null,
      ip_address: cliente.ip ?? null,
      user_agent: cliente.userAgent ?? null,
      expira_en_unix,
    },
    conn
  );

  return { access_token, refresh_token, usuario: usuarioPublico(usuario) };
};

const REFRESH_INVALIDO = "Refresh token inválido o expirado";

/**
 * Renueva una sesión con su refresh token: firma tokens nuevos en la misma fila
 * de `sesiones` y extiende su vencimiento (REFRESH_EXPIRES_IN desde ahora).
 * El refresh token y el access token anteriores dejan de servir.
 * 401 si el token no es válido o la sesión se cerró o venció; 403 si la cuenta está desactivada.
 */
export const refreshSession = async (refresh_token, cliente = {}) => {
  let payload;
  try {
    payload = verifyRefreshToken(refresh_token);
  } catch {
    throw ApiError.unauthorized(REFRESH_INVALIDO);
  }

  return withTransaction(async (conn) => {
    const sesion = await sessionRepo.findActiveByRefreshHashForUpdate(hashToken(refresh_token), conn);
    if (!sesion || sesion.id_usuario !== payload.id_usuario) throw ApiError.unauthorized(REFRESH_INVALIDO);

    const usuario = await usuarioRepo.findById(sesion.id_usuario, conn);
    if (!usuario.activo) throw ApiError.forbidden("La cuenta está desactivada");

    const tokens = firmarTokens(usuario);
    await sessionRepo.rotate(
      sesion.id_sesion,
      {
        token_hash: hashToken(tokens.access_token),
        refresh_token_hash: hashToken(tokens.refresh_token),
        ip_address: cliente.ip ?? null,
        user_agent: cliente.userAgent ?? null,
        expira_en_unix: tokens.expira_en_unix,
      },
      conn
    );
    await usuarioRepo.touchUltimoAcceso(usuario.id_usuario, conn);

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      usuario: usuarioPublico(usuario),
    };
  });
};
