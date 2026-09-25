import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import * as sessionRepo from "./session.repository.js";
import { generateToken } from "../../shared/utils/jwt.js";
import { generateRefreshToken } from "../../shared/utils/tokens.js";
import { hashToken } from "../../shared/utils/hash.js";
import { usuarioPublico } from "../../shared/utils/sanitize.js";

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
  const payload = {
    id_usuario: usuario.id_usuario,
    email: usuario.email,
    tipo_usuario: usuario.tipo_usuario,
  };
  // jti distinto en cada token: dos inicios de sesión en el mismo segundo no generan el mismo hash.
  const access_token = generateToken({ ...payload, jti: randomUUID() });
  const refresh_token = generateRefreshToken({ ...payload, jti: randomUUID() });

  // La sesión dura lo mismo que el refresh token.
  const { exp } = jwt.decode(refresh_token);

  await sessionRepo.create(
    {
      id_usuario: usuario.id_usuario,
      token_hash: hashToken(access_token),
      refresh_token_hash: hashToken(refresh_token),
      dispositivo: cliente.dispositivo ?? null,
      ip_address: cliente.ip ?? null,
      user_agent: cliente.userAgent ?? null,
      expira_en_unix: exp,
    },
    conn
  );

  return { access_token, refresh_token, usuario: usuarioPublico(usuario) };
};
