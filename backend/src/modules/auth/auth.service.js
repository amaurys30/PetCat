import { randomBytes } from "node:crypto";
import * as usuarioRepo from "../usuarios/usuario.repository.js";
import * as sessionRepo from "../sessions/session.repository.js";
import * as autorizacionRepo from "../autorizaciones/autorizacion.repository.js";
import * as configuracionRepo from "../configuracion/configuracion.repository.js";
import { createSessionForUser } from "../sessions/session.service.js";
import { getMisNegocios } from "../negocios/negocio.service.js";
import { correoBienvenida, correoRecuperacion, correoVerificacion } from "./auth.mail.js";
import { hashPassword, comparePassword, hashToken } from "../../shared/utils/hash.js";
import { usuarioPublico } from "../../shared/utils/sanitize.js";
import { castFields } from "../../shared/utils/format.js";
import { sendMail } from "../../shared/utils/mailer.js";
import { withTransaction } from "../../shared/utils/transaction.js";
import { ApiError } from "../../shared/errors/ApiError.js";
import { quitarImagen, reemplazarImagen } from "../archivos/archivo.service.js";
import { desconectarSesionesDeUsuario } from "../../realtime/socket.js";
import { isTest } from "../../config/env.js";

export const MAX_INTENTOS_LOGIN = 5;
export const MINUTOS_BLOQUEO = 15;
export const MINUTOS_VERIFICACION = 24 * 60;
export const MINUTOS_RECUPERACION = 60;

const CREDENCIALES_INVALIDAS = "Credenciales inválidas";
const CUENTA_BLOQUEADA = `Cuenta bloqueada por demasiados intentos fallidos. Intenta de nuevo en ${MINUTOS_BLOQUEO} minutos`;
const CUENTA_DESACTIVADA = "La cuenta está desactivada";

// Hash para comparar cuando el email no existe: la respuesta tarda lo mismo y no delata qué emails están registrados.
let dummyHash;
const getDummyHash = async () => (dummyHash ??= await hashPassword("petcat-usuario-inexistente"));

/** Token para enlaces de correo: 32 bytes aleatorios en hexadecimal. En la base va su SHA-256. */
const nuevoToken = () => {
  const token = randomBytes(32).toString("hex");
  return { token, token_hash: hashToken(token) };
};

/**
 * Envía un correo sin esperar ni fallar la petición si el SMTP no responde
 * (registro y forgot-password). Solo registra el error.
 */
const enviarSinEsperar = (mail, contexto) => {
  sendMail(mail).catch((err) => {
    if (!isTest) console.error(`Error enviando el correo de ${contexto}:`, err.message);
  });
};

/** Versión vigente de la política de datos que acepta el titular. */
export const versionPolitica = () => configuracionRepo.getValor("terminos_version", "1.0");

/**
 * El registro exige aceptar la política de datos y la guarda (canal app), deja
 * un token de verificación y envía el correo; si el envío falla, se pide otro
 * con resend-verification. Email existente: 409 que sugiere "Olvidé mi
 * contraseña" (la cuenta pudo crearla un negocio desde el panel).
 */
export const register = async ({ nombre, apellido, email, password, telefono, tipo_usuario }, cliente = {}) => {
  if (await usuarioRepo.findByEmail(email)) {
    throw ApiError.conflict(
      "Ya existe una cuenta con ese correo. Si no recuerdas la contraseña o un negocio te registró, usa \"Olvidé mi contraseña\" para activarla",
      { email: "Ya está registrado" }
    );
  }

  const { token, token_hash } = nuevoToken();
  const version_politica = await versionPolitica();
  const id_usuario = await withTransaction(async (conn) => {
    const id = await usuarioRepo.create(
      { nombre, apellido, email, password_hash: await hashPassword(password), telefono, tipo_usuario },
      conn
    );
    await autorizacionRepo.create(
      { id_usuario: id, canal: "app", id_usuario_registro: id, version_politica, ip_address: cliente.ip ?? null },
      conn
    );
    await usuarioRepo.setToken(id, "verificacion", { token_hash, minutos: MINUTOS_VERIFICACION }, conn);
    return id;
  });

  enviarSinEsperar(correoVerificacion({ token, email, nombre, minutos: MINUTOS_VERIFICACION }), "verificación");
  return usuarioPublico(await usuarioRepo.findById(id_usuario));
};

/**
 * Comprueba la contraseña con las reglas del login. Con la cuenta bloqueada no se
 * evalúa: no se puede seguir probando (403). Un fallo suma al contador y al llegar
 * al máximo bloquea la cuenta (403); si no, lanza `errorSiFalla` (401 por defecto).
 * Cuenta inactiva: 403.
 * La usan el login, aceptar una invitación con una cuenta existente y el cambio de contraseña.
 * @param {object} usuario Fila de usuarioRepo.findForLogin (incluye `bloqueado`)
 * @param {string} password
 * @param {ApiError} [errorSiFalla]
 */
export const verificarPassword = async (
  usuario,
  password,
  errorSiFalla = ApiError.unauthorized(CREDENCIALES_INVALIDAS)
) => {
  if (usuario.bloqueado) throw ApiError.forbidden(CUENTA_BLOQUEADA);

  if (!(await comparePassword(password, usuario.password_hash))) {
    const bloqueado = await usuarioRepo.registerFailedLogin(
      usuario.id_usuario,
      MAX_INTENTOS_LOGIN,
      MINUTOS_BLOQUEO
    );
    if (bloqueado) throw ApiError.forbidden(CUENTA_BLOQUEADA);
    throw errorSiFalla;
  }

  if (!usuario.activo) throw ApiError.forbidden(CUENTA_DESACTIVADA);
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

// ---------- Perfil propio ----------

/** Perfil de la cuenta con sus preferencias (GET y PATCH /auth/me). */
const perfilPropio = (usuario) => ({
  ...usuarioPublico(usuario),
  ...castFields(
    {
      telefono_verificado: usuario.telefono_verificado,
      idioma: usuario.idioma,
      zona_horaria: usuario.zona_horaria,
      notif_email: usuario.notif_email,
      notif_push: usuario.notif_push,
      notif_whatsapp: usuario.notif_whatsapp,
      ultimo_acceso: usuario.ultimo_acceso,
      fecha_registro: usuario.fecha_registro,
    },
    { bools: ["telefono_verificado", "notif_email", "notif_push", "notif_whatsapp"] }
  ),
});

/**
 * Perfil y negocios a los que el usuario puede entrar (mismo formato que GET /negocios/mios).
 * `requiere_aceptar_politica`: no tiene una autorización vigente para la versión actual de la política.
 * `politica`: versión vigente y enlace al texto completo, para mostrarlos al pedir la aceptación.
 */
export const getMe = async (id_usuario) => {
  const [version, url] = await Promise.all([
    versionPolitica(),
    configuracionRepo.getValor("politica_datos_url", ""),
  ]);
  const [usuario, negocios, vigente] = await Promise.all([
    usuarioRepo.findById(id_usuario),
    getMisNegocios(id_usuario),
    autorizacionRepo.findVigente(id_usuario, version),
  ]);
  return {
    ...perfilPropio(usuario),
    requiere_aceptar_politica: !vigente,
    politica: { version, url: url || null },
    negocios,
  };
};

/**
 * Una cuenta existente acepta la versión vigente de la política (canal aceptacion).
 * Si ya la había aceptado no crea otra fila. Devuelve la autorización y si es nueva.
 */
export const aceptarPolitica = async (id_usuario, cliente = {}) => {
  const version_politica = await versionPolitica();
  const existente = await autorizacionRepo.findVigente(id_usuario, version_politica);
  if (existente) return { autorizacion: existente, nueva: false };
  await autorizacionRepo.create({
    id_usuario,
    canal: "aceptacion",
    id_usuario_registro: id_usuario,
    version_politica,
    ip_address: cliente.ip ?? null,
  });
  return { autorizacion: await autorizacionRepo.findVigente(id_usuario, version_politica), nueva: true };
};

export const updateMe = async (id_usuario, data) => {
  await usuarioRepo.updatePerfil(id_usuario, data);
  return perfilPropio(await usuarioRepo.findById(id_usuario));
};

// ---------- Foto de perfil ----------

const fotoDelUsuario = (id_usuario) => ({
  entidad: "usuario_foto",
  id_entidad: id_usuario,
  id_usuario,
  bloquear: async (conn) => (await usuarioRepo.lockFoto(id_usuario, conn)).foto_url,
  guardarUrl: (conn, url) => usuarioRepo.setFoto(id_usuario, url, conn),
});

/** Sube o reemplaza la foto de perfil; la anterior se borra. */
export const subirFoto = async (id_usuario, archivo) => {
  await reemplazarImagen({ ...fotoDelUsuario(id_usuario), archivo });
  return perfilPropio(await usuarioRepo.findById(id_usuario));
};

export const eliminarFoto = async (id_usuario) => {
  await quitarImagen({ ...fotoDelUsuario(id_usuario), sinImagen: "No tienes foto de perfil" });
  return perfilPropio(await usuarioRepo.findById(id_usuario));
};

// ---------- Contraseña ----------

/**
 * Cambia la contraseña con la sesión iniciada. La actual se comprueba con las
 * reglas del login (los fallos cuentan para el bloqueo). Cierra las demás sesiones.
 */
export const changePassword = async (id_usuario, id_sesion, { password_actual, password_nueva }) => {
  const usuario = await usuarioRepo.findForLoginById(id_usuario);
  await verificarPassword(
    usuario,
    password_actual,
    ApiError.unprocessable("La contraseña actual no es correcta", { password_actual: "Contraseña incorrecta" })
  );

  if (await comparePassword(password_nueva, usuario.password_hash)) {
    throw ApiError.unprocessable("Datos inválidos", { password_nueva: "Debe ser distinta de la actual" });
  }

  const password_hash = await hashPassword(password_nueva);
  await withTransaction(async (conn) => {
    await usuarioRepo.updatePassword(id_usuario, password_hash, conn);
    await sessionRepo.deactivateByUsuario(id_usuario, { exceptoIdSesion: id_sesion }, conn);
  });
  // Las demás sesiones ya no valen: sus sockets tampoco deben seguir recibiendo notificaciones.
  await desconectarSesionesDeUsuario(id_usuario, { exceptoIdSesion: id_sesion });
};

/**
 * Envía el enlace para restablecer la contraseña. Responde igual exista o no el
 * email (no delata cuentas), y el correo se envía sin esperar. Funciona aunque la
 * cuenta esté bloqueada por intentos fallidos; a una cuenta desactivada no se le envía.
 * Máximo un correo por minuto por cuenta; cada enlace nuevo invalida el anterior.
 */
export const forgotPassword = async ({ email }) => {
  const usuario = await usuarioRepo.findByEmail(email);
  if (!usuario?.activo) return;

  const { token, token_hash } = nuevoToken();
  const guardado = await usuarioRepo.setToken(usuario.id_usuario, "recuperacion", {
    token_hash,
    minutos: MINUTOS_RECUPERACION,
  });
  if (!guardado) return;

  enviarSinEsperar(
    correoRecuperacion({ token, email: usuario.email, nombre: usuario.nombre, minutos: MINUTOS_RECUPERACION }),
    "recuperación de contraseña"
  );
};

/**
 * Cambia la contraseña con el token del correo. Desbloquea la cuenta (reinicia
 * los intentos), marca el email como verificado (el enlace llegó a ese correo) y
 * cierra todas las sesiones. 400 si el token no existe, ya se usó o venció.
 */
export const resetPassword = async ({ token, password }) => {
  const password_hash = await hashPassword(password);
  const id_usuario = await withTransaction(async (conn) => {
    const usuario = await usuarioRepo.findByTokenHash("recuperacion", hashToken(token), { conn, forUpdate: true });
    if (!usuario) {
      throw ApiError.badRequest("El enlace para restablecer la contraseña no es válido o ya venció. Solicita uno nuevo");
    }
    if (!usuario.activo) throw ApiError.forbidden(CUENTA_DESACTIVADA);

    await usuarioRepo.updatePassword(usuario.id_usuario, password_hash, conn);
    await usuarioRepo.markEmailVerificado(usuario.id_usuario, conn);
    await sessionRepo.deactivateByUsuario(usuario.id_usuario, {}, conn);
    return usuario.id_usuario;
  });
  await desconectarSesionesDeUsuario(id_usuario);
};

// ---------- Clientes registrados por un negocio ----------

/** Vigencia del enlace de bienvenida para crear la contraseña: 7 días. */
export const MINUTOS_BIENVENIDA = 7 * 24 * 60;

/**
 * Deja el token para que un cliente registrado por un negocio cree su contraseña
 * (mismo flujo que restablecer, con vigencia de 7 días). Devuelve el token real.
 */
export const emitirEnlaceBienvenida = async (id_usuario, conn) => {
  const { token, token_hash } = nuevoToken();
  await usuarioRepo.setToken(id_usuario, "recuperacion", { token_hash, minutos: MINUTOS_BIENVENIDA }, conn);
  return token;
};

/** Correo de bienvenida con el nombre del negocio; se envía sin esperar. */
export const enviarBienvenida = async ({ token, email, nombre, negocio }) => {
  const [politicaUrl, soporte] = await Promise.all([
    configuracionRepo.getValor("politica_datos_url", ""),
    configuracionRepo.getValor("soporte_email", ""),
  ]);
  enviarSinEsperar(
    correoBienvenida({ token, email, nombre, negocio, minutos: MINUTOS_BIENVENIDA, politicaUrl, soporte }),
    "bienvenida"
  );
};

// ---------- Verificación de email ----------

/** 400 si el token no existe, ya se usó o venció. */
export const verifyEmail = async (token) => {
  await withTransaction(async (conn) => {
    const usuario = await usuarioRepo.findByTokenHash("verificacion", hashToken(token), { conn, forUpdate: true });
    if (!usuario) throw ApiError.badRequest("El enlace de verificación no es válido o ya venció");
    await usuarioRepo.markEmailVerificado(usuario.id_usuario, conn);
  });
};

/**
 * Envía un enlace de verificación nuevo (invalida el anterior). 409 si el correo
 * ya está verificado; 429 si se envió otro hace menos de un minuto; 503 si el
 * correo no se pudo enviar (no se guarda el token).
 */
export const resendVerification = async (id_usuario) =>
  withTransaction(async (conn) => {
    const usuario = await usuarioRepo.findById(id_usuario, conn);
    if (usuario.email_verificado) throw ApiError.conflict("Tu correo ya está verificado");

    const { token, token_hash } = nuevoToken();
    const guardado = await usuarioRepo.setToken(
      id_usuario,
      "verificacion",
      { token_hash, minutos: MINUTOS_VERIFICACION },
      conn
    );
    if (!guardado) throw ApiError.tooMany("Ya te enviamos un correo hace menos de un minuto. Espera un momento");

    try {
      await sendMail(
        correoVerificacion({ token, email: usuario.email, nombre: usuario.nombre, minutos: MINUTOS_VERIFICACION })
      );
    } catch (err) {
      if (!isTest) console.error("Error enviando el correo de verificación:", err.message);
      throw ApiError.serviceUnavailable("No se pudo enviar el correo de verificación. Intenta de nuevo en unos minutos");
    }
    return { email: usuario.email };
  });
