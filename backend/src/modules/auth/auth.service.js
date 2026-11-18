import { randomBytes } from "node:crypto";
import * as usuarioRepo from "../usuarios/usuario.repository.js";
import * as sessionRepo from "../sessions/session.repository.js";
import * as autorizacionRepo from "../autorizaciones/autorizacion.repository.js";
import * as configuracionRepo from "../configuracion/configuracion.repository.js";
import { getPoliticaVigente, versionPolitica } from "../autorizaciones/autorizacion.service.js";
import { createSessionForUser } from "../sessions/session.service.js";
import { getMisNegocios } from "../negocios/negocio.service.js";
import { correoBienvenida, correoRecuperacion, correoVerificacion } from "./auth.mail.js";
import * as codigos from "./codigo.service.js";
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

export { versionPolitica };

const CODIGO_INVALIDO = "El código no es válido o ya venció. Solicita uno nuevo";
const LIMITE_CORREOS = {
  minuto: "Ya te enviamos un correo hace menos de un minuto. Espera un momento",
  hora: `Ya te enviamos ${codigos.CODIGOS_POR_HORA} correos en la última hora. Intenta más tarde`,
};

const MINUTOS_ENLACE = { verificacion: MINUTOS_VERIFICACION, recuperacion: MINUTOS_RECUPERACION };

/**
 * Emite el enlace y el código de un correo de verificación o recuperación (el mismo correo
 * lleva los dos: el enlace para el panel web, el código para la app). Respeta el límite por
 * cuenta (1 por minuto, 5 por hora) y devuelve `{ limite }` si se superó.
 */
const emitirEnlaceYCodigo = async (id_usuario, tipo, conn) => {
  const limite = await codigos.limiteAlcanzado(id_usuario, tipo, conn);
  if (limite) return { limite };
  const { token, token_hash } = nuevoToken();
  await usuarioRepo.setToken(id_usuario, tipo, { token_hash, minutos: MINUTOS_ENLACE[tipo], forzar: true }, conn);
  const codigo = await codigos.emitir(id_usuario, tipo, conn);
  return { token, codigo };
};

/**
 * El registro exige aceptar la política de datos y la guarda con el canal del
 * registro ("app" o "panel_web"), deja
 * un token de verificación y envía el correo; si el envío falla, se pide otro
 * con resend-verification. Email existente: 409 que sugiere "Olvidé mi
 * contraseña" (la cuenta pudo crearla un negocio desde el panel).
 */
export const register = async ({ nombre, apellido, email, password, telefono, tipo_usuario, canal }, cliente = {}) => {
  if (await usuarioRepo.findByEmail(email)) {
    throw ApiError.conflict(
      "Ya existe una cuenta con ese correo. Si no recuerdas la contraseña o un negocio te registró, usa \"Olvidé mi contraseña\" para activarla",
      { email: "Ya está registrado" }
    );
  }

  const version_politica = await versionPolitica();
  const { id_usuario, token, codigo } = await withTransaction(async (conn) => {
    const id = await usuarioRepo.create(
      { nombre, apellido, email, password_hash: await hashPassword(password), telefono, tipo_usuario },
      conn
    );
    await autorizacionRepo.create(
      { id_usuario: id, canal, id_usuario_registro: id, version_politica, ip_address: cliente.ip ?? null },
      conn
    );
    return { id_usuario: id, ...(await emitirEnlaceYCodigo(id, "verificacion", conn)) };
  });

  enviarSinEsperar(correoVerificacion({ token, codigo, email, nombre, minutos: MINUTOS_VERIFICACION }), "verificación");
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
 * `politica_aceptada`: la última autorización no revocada (puede ser de una versión anterior).
 */
export const getMe = async (id_usuario) => {
  const politica = await getPoliticaVigente();
  const [usuario, negocios, vigente, ultima] = await Promise.all([
    usuarioRepo.findById(id_usuario),
    getMisNegocios(id_usuario),
    autorizacionRepo.findVigente(id_usuario, politica.version),
    autorizacionRepo.findUltima(id_usuario),
  ]);
  return {
    ...perfilPropio(usuario),
    requiere_aceptar_politica: !vigente,
    politica,
    politica_aceptada: ultima
      ? { version: ultima.version_politica, fecha: ultima.fecha_autorizacion, canal: ultima.canal }
      : null,
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
 * Envía el enlace y el código para restablecer la contraseña. Responde igual exista o no
 * el email (no delata cuentas), y el correo se envía sin esperar. Funciona aunque la
 * cuenta esté bloqueada por intentos fallidos; a una cuenta desactivada no se le envía.
 * Máximo un correo por minuto y cinco por hora por cuenta; cada correo nuevo invalida el
 * enlace y el código anteriores (también un enlace de bienvenida pendiente).
 */
export const forgotPassword = async ({ email }) => {
  const usuario = await usuarioRepo.findByEmail(email);
  if (!usuario?.activo) return;

  const emitido = await withTransaction((conn) => emitirEnlaceYCodigo(usuario.id_usuario, "recuperacion", conn));
  if (emitido.limite) return;

  enviarSinEsperar(
    correoRecuperacion({
      token: emitido.token,
      codigo: emitido.codigo,
      email: usuario.email,
      nombre: usuario.nombre,
      minutos: MINUTOS_RECUPERACION,
    }),
    "recuperación de contraseña"
  );
};

/**
 * Cambia la contraseña de un usuario ya comprobado (enlace o código): desbloquea la cuenta
 * (reinicia los intentos), marca el email como verificado (el correo llegó), cierra los
 * códigos abiertos y todas las sesiones. Va dentro de la transacción de quien llama.
 */
const cambiarPasswordRecuperada = async (id_usuario, password_hash, motivoCodigos, conn) => {
  await usuarioRepo.updatePassword(id_usuario, password_hash, conn);
  await usuarioRepo.markEmailVerificado(id_usuario, conn);
  await codigos.cerrarAbiertos(id_usuario, null, motivoCodigos, conn);
  await sessionRepo.deactivateByUsuario(id_usuario, {}, conn);
};

/**
 * Cambia la contraseña con el token del correo. 400 si el token no existe, ya se usó o venció.
 * Usar el enlace invalida también el código del mismo correo.
 */
export const resetPassword = async ({ token, password }) => {
  const password_hash = await hashPassword(password);
  const id_usuario = await withTransaction(async (conn) => {
    const usuario = await usuarioRepo.findByTokenHash("recuperacion", hashToken(token), { conn, forUpdate: true });
    if (!usuario) {
      throw ApiError.badRequest("El enlace para restablecer la contraseña no es válido o ya venció. Solicita uno nuevo");
    }
    if (!usuario.activo) throw ApiError.forbidden(CUENTA_DESACTIVADA);

    await cambiarPasswordRecuperada(usuario.id_usuario, password_hash, "enlace", conn);
    return usuario.id_usuario;
  });
  await desconectarSesionesDeUsuario(id_usuario);
};

/**
 * Cambia la contraseña con el código de 6 dígitos del correo (app móvil). Igual que con el
 * enlace: desbloquea, verifica el email y cierra todas las sesiones. Mismo 400 si el email no
 * existe, la cuenta está desactivada o el código no coincide, ya se usó, venció o se cerró
 * por intentos: la respuesta no delata cuentas. Cada fallo cuenta (5 cierran el código).
 */
export const resetPasswordConCodigo = async ({ email, codigo, password }) => {
  const password_hash = await hashPassword(password);
  const usuario = await usuarioRepo.findByEmail(email);

  // La transacción termina (commit) también cuando el código falla: el intento queda contado.
  const id_usuario = await withTransaction(async (conn) => {
    if (!usuario?.activo) return codigos.comprobarSinCuenta(codigo) || null;
    if (!(await codigos.comprobar(usuario.id_usuario, "recuperacion", codigo, conn))) return null;
    await cambiarPasswordRecuperada(usuario.id_usuario, password_hash, "usado", conn);
    return usuario.id_usuario;
  });

  if (!id_usuario) throw ApiError.badRequest(CODIGO_INVALIDO);
  await desconectarSesionesDeUsuario(id_usuario);
};

// ---------- Clientes registrados por un negocio ----------

/** Vigencia del enlace de bienvenida para crear la contraseña: 7 días. */
export const MINUTOS_BIENVENIDA = 7 * 24 * 60;

/**
 * Deja el token para que un cliente registrado por un negocio cree su contraseña
 * (mismo flujo que restablecer, con vigencia de 7 días). Reemplaza el enlace anterior.
 * Devuelve el token real, o null si ya se emitió uno hace menos de `esperaMinutos`
 * (con 0 siempre se emite: al corregir un correo el enlace anterior no debe servir).
 */
export const emitirEnlaceBienvenida = async (id_usuario, conn, { esperaMinutos = 1 } = {}) => {
  const { token, token_hash } = nuevoToken();
  const emitido = await usuarioRepo.setToken(id_usuario, "recuperacion", { token_hash, minutos: MINUTOS_BIENVENIDA, esperaMinutos }, conn);
  return emitido ? token : null;
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

/** 400 si el token no existe, ya se usó o venció. Usar el enlace invalida también el código. */
export const verifyEmail = async (token) => {
  await withTransaction(async (conn) => {
    const usuario = await usuarioRepo.findByTokenHash("verificacion", hashToken(token), { conn, forUpdate: true });
    if (!usuario) throw ApiError.badRequest("El enlace de verificación no es válido o ya venció");
    await usuarioRepo.markEmailVerificado(usuario.id_usuario, conn);
    await codigos.cerrarAbiertos(usuario.id_usuario, "verificacion", "enlace", conn);
  });
};

/**
 * Verifica el email con el código de 6 dígitos del correo (app móvil, con sesión). Invalida
 * también el enlace del mismo correo. 409 si ya está verificado; 400 si el código no coincide,
 * ya se usó, venció o se cerró por intentos (cada fallo cuenta; 5 cierran el código).
 */
export const verifyEmailConCodigo = async (id_usuario, codigo) => {
  const usuario = await usuarioRepo.findById(id_usuario);
  if (usuario.email_verificado) throw ApiError.conflict("Tu correo ya está verificado");

  // La transacción termina (commit) también cuando el código falla: el intento queda contado.
  const valido = await withTransaction(async (conn) => {
    if (!(await codigos.comprobar(id_usuario, "verificacion", codigo, conn))) return false;
    await usuarioRepo.markEmailVerificado(id_usuario, conn);
    return true;
  });
  if (!valido) throw ApiError.badRequest(CODIGO_INVALIDO);
};

/**
 * Sin sesión (el enlace venció o se abrió en otro dispositivo): envía un enlace y un código
 * de verificación nuevos si la cuenta existe, está activa y no está verificada. Responde
 * igual en todos los casos (no delata cuentas) y el correo se envía sin esperar.
 * Máximo uno por minuto y cinco por hora por cuenta; cada correo nuevo invalida el anterior.
 */
export const requestVerification = async ({ email }) => {
  const usuario = await usuarioRepo.findByEmail(email);
  if (!usuario?.activo || usuario.email_verificado) return;

  const emitido = await withTransaction((conn) => emitirEnlaceYCodigo(usuario.id_usuario, "verificacion", conn));
  if (emitido.limite) return;

  enviarSinEsperar(
    correoVerificacion({
      token: emitido.token,
      codigo: emitido.codigo,
      email: usuario.email,
      nombre: usuario.nombre,
      minutos: MINUTOS_VERIFICACION,
    }),
    "verificación"
  );
};

/**
 * Envía un enlace y un código de verificación nuevos (invalida los anteriores). 409 si el
 * correo ya está verificado; 429 si se envió otro hace menos de un minuto o ya van cinco en
 * la última hora; 503 si el correo no se pudo enviar (no se guarda nada).
 */
export const resendVerification = async (id_usuario) =>
  withTransaction(async (conn) => {
    const usuario = await usuarioRepo.findById(id_usuario, conn);
    if (usuario.email_verificado) throw ApiError.conflict("Tu correo ya está verificado");

    const emitido = await emitirEnlaceYCodigo(id_usuario, "verificacion", conn);
    if (emitido.limite) throw ApiError.tooMany(LIMITE_CORREOS[emitido.limite]);
    const { token, codigo } = emitido;

    try {
      await sendMail(
        correoVerificacion({ token, codigo, email: usuario.email, nombre: usuario.nombre, minutos: MINUTOS_VERIFICACION })
      );
    } catch (err) {
      if (!isTest) console.error("Error enviando el correo de verificación:", err.message);
      throw ApiError.serviceUnavailable("No se pudo enviar el correo de verificación. Intenta de nuevo en unos minutos");
    }
    return { email: usuario.email };
  });
