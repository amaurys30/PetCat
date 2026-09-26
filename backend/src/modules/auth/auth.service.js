import * as usuarioRepo from "../usuarios/usuario.repository.js";
import { createSessionForUser } from "../sessions/session.service.js";
import { hashPassword, comparePassword } from "../../shared/utils/hash.js";
import { usuarioPublico } from "../../shared/utils/sanitize.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { ApiError } from "../../shared/errors/ApiError.js";

export const MAX_INTENTOS_LOGIN = 5;
export const MINUTOS_BLOQUEO = 15;

const CREDENCIALES_INVALIDAS = "Credenciales inválidas";
const CUENTA_BLOQUEADA = `Cuenta bloqueada por demasiados intentos fallidos. Intenta de nuevo en ${MINUTOS_BLOQUEO} minutos`;

// Hash para comparar cuando el email no existe: la respuesta tarda lo mismo y no delata qué emails están registrados.
let dummyHash;
const getDummyHash = async () => (dummyHash ??= await hashPassword("petcat-usuario-inexistente"));

export const register = async ({ nombre, apellido, email, password, telefono, tipo_usuario }) => {
  if (await usuarioRepo.findByEmail(email)) {
    throw ApiError.conflict("Ya existe una cuenta con ese correo", { email: "Ya está registrado" });
  }

  const id_usuario = await usuarioRepo.create({
    nombre,
    apellido,
    email,
    password_hash: await hashPassword(password),
    telefono,
    tipo_usuario,
  });

  return usuarioPublico(await usuarioRepo.findById(id_usuario));
};

/**
 * Comprueba la contraseña con las reglas del login. Con la cuenta bloqueada no se
 * evalúa: no se puede seguir probando (403). Un fallo suma al contador y al llegar
 * al máximo bloquea la cuenta (403); si no, 401 con `mensajeError`. Cuenta inactiva: 403.
 * La usan el login y aceptar una invitación con una cuenta existente.
 * @param {object} usuario Fila de usuarioRepo.findForLogin (incluye `bloqueado`)
 */
export const verificarPassword = async (usuario, password, mensajeError = CREDENCIALES_INVALIDAS) => {
  if (usuario.bloqueado) throw ApiError.forbidden(CUENTA_BLOQUEADA);

  if (!(await comparePassword(password, usuario.password_hash))) {
    const bloqueado = await usuarioRepo.registerFailedLogin(
      usuario.id_usuario,
      MAX_INTENTOS_LOGIN,
      MINUTOS_BLOQUEO
    );
    if (bloqueado) throw ApiError.forbidden(CUENTA_BLOQUEADA);
    throw ApiError.unauthorized(mensajeError);
  }

  if (!usuario.activo) throw ApiError.forbidden("La cuenta está desactivada");
};

/**
 * @param {{ email: string, password: string, dispositivo?: string }} credenciales
 * @param {{ ip?: string, userAgent?: string }} cliente
 */
export const login = async ({ email, password, dispositivo }, cliente = {}) => {
  const usuario = await usuarioRepo.findForLogin(email);

  if (!usuario) {
    await comparePassword(password, await getDummyHash());
    throw ApiError.unauthorized(CREDENCIALES_INVALIDAS);
  }

  await verificarPassword(usuario, password);

  return withTransaction(async (conn) => {
    await usuarioRepo.registerSuccessfulLogin(usuario.id_usuario, conn);
    return createSessionForUser(usuario, { ...cliente, dispositivo }, conn);
  });
};
