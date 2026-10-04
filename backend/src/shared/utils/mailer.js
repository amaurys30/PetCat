import nodemailer from "nodemailer";
import { env, isTest } from "../../config/env.js";

/**
 * Correos enviados durante los tests (no salen a la red). Los tests de
 * invitaciones leen de aquí el enlace; `clearOutbox()` entre tests.
 */
export const outbox = [];

export const clearOutbox = () => {
  outbox.length = 0;
};

/**
 * Cifrado efectivo del SMTP: SMTP_SECURE si se definió; si no, "tls" en el puerto 465,
 * "starttls" si hay usuario (un servidor real) y "none" sin usuario (Mailpit, local).
 */
export const modoSeguro = ({ SMTP_SECURE, SMTP_PORT, SMTP_USER }) =>
  SMTP_SECURE ?? (SMTP_PORT === 465 ? "tls" : SMTP_USER ? "starttls" : "none");

/**
 * Opciones de Nodemailer para la configuración `config` (por defecto, la del proceso).
 * - "tls": TLS desde el primer byte (puerto 465).
 * - "starttls": conecta sin cifrar y exige STARTTLS antes de autenticar (puerto 587).
 * - "none": sin cifrar ni intentar STARTTLS (Mailpit).
 * Sin SMTP_USER no hay autenticación. Los tres tiempos límite usan SMTP_TIMEOUT_MS (10 s
 * por defecto): conexión TCP, saludo del servidor e inactividad del socket.
 */
export const transportOptions = (config = env) => {
  const modo = modoSeguro(config);
  return {
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: modo === "tls",
    requireTLS: modo === "starttls",
    ignoreTLS: modo === "none",
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
    connectionTimeout: config.SMTP_TIMEOUT_MS,
    greetingTimeout: config.SMTP_TIMEOUT_MS,
    socketTimeout: config.SMTP_TIMEOUT_MS,
  };
};

/**
 * Error de Nodemailer explicado para quien configura el correo (comando mail:test y
 * registros). Nunca incluye la contraseña.
 */
export const explicarErrorSmtp = (err, config = env) => {
  const destino = `${config.SMTP_HOST}:${config.SMTP_PORT}`;
  const texto = `${err?.code ?? ""} ${err?.message ?? ""}`;
  if (err?.code === "EAUTH") {
    return `El servidor rechazó el usuario o la contraseña (SMTP_USER / SMTP_PASS). En Gmail hace falta una contraseña de aplicación, no la de la cuenta.`;
  }
  if (/ENOTFOUND|EAI_AGAIN|EDNS/.test(texto)) {
    return `No se encontró el servidor "${config.SMTP_HOST}" (SMTP_HOST). Revisa el nombre; dentro de Docker, Mailpit es "mailpit" y desde el host es "localhost".`;
  }
  if (/ECONNREFUSED/.test(texto)) {
    return `Nadie respondió en ${destino}: el servidor no está corriendo o el puerto (SMTP_PORT) es otro.`;
  }
  if (/ETIMEDOUT|timeout/i.test(texto)) {
    return `El servidor ${destino} no respondió en ${config.SMTP_TIMEOUT_MS} ms (SMTP_TIMEOUT_MS). Revisa el puerto o si un firewall lo bloquea.`;
  }
  if (/wrong version number|ssl3_get_record|SSL routines|EPROTO|packet length too long/i.test(texto)) {
    return `Falló el cifrado con ${destino}: el modo no coincide con el puerto. Usa SMTP_SECURE=tls con 465 y SMTP_SECURE=starttls con 587.`;
  }
  if (/STARTTLS|ETLS/i.test(texto)) {
    return `El servidor ${destino} no ofrece STARTTLS. Usa SMTP_SECURE=tls (465) o, solo para un servidor local, SMTP_SECURE=none.`;
  }
  if (/certificate|CERT_|self.signed/i.test(texto)) {
    return `El certificado TLS de ${destino} no es válido para "${config.SMTP_HOST}". Revisa el nombre del servidor.`;
  }
  if (err?.code === "EENVELOPE") {
    return `El servidor rechazó el remitente o el destinatario (MAIL_FROM debe ser una dirección que el proveedor te deje usar): ${err.message}`;
  }
  return err?.message ?? String(err);
};

let transporter;

const getTransporter = () => {
  transporter ??= nodemailer.createTransport(transportOptions());
  return transporter;
};

/**
 * Envía un correo. Incluir siempre `text` (con el enlace, si lo hay): es lo que
 * se muestra en consola cuando no hay SMTP y lo que leen los clientes sin HTML.
 * - Tests: se guarda en `outbox`.
 * - Sin SMTP_HOST (solo desarrollo; en producción env.js lo exige): se muestra en consola.
 * - Con SMTP_HOST: se envía con Nodemailer. Si falla, el mensaje del error lleva la causa
 *   explicada (explicarErrorSmtp) y el original entre corchetes.
 *
 * @param {{ to: string, subject: string, text: string, html?: string, headers?: Record<string, string> }} mail
 *   `headers`: cabeceras adicionales (p. ej. List-Unsubscribe en los correos de notificaciones).
 */
export const sendMail = async ({ to, subject, text, html, headers }) => {
  const mail = { from: env.MAIL_FROM, to, subject, text, html, ...(headers && { headers }) };

  if (isTest) {
    outbox.push(mail);
    return { delivered: false, mode: "test" };
  }

  if (!env.SMTP_HOST) {
    console.log(
      ["", "---- Correo (sin SMTP configurado) ----", `Para:   ${to}`, `Asunto: ${subject}`, "", text, "--------------------------------------", ""].join("\n")
    );
    return { delivered: false, mode: "console" };
  }

  try {
    const info = await getTransporter().sendMail(mail);
    return { delivered: true, mode: "smtp", messageId: info.messageId };
  } catch (err) {
    // Quien lo registra (console.error de cada envío) muestra la causa en palabras claras.
    err.message = `${explicarErrorSmtp(err)} [${err.message}]`;
    throw err;
  }
};

/** Escapa texto para insertarlo en el HTML de un correo. */
export const escapeHtml = (texto) =>
  String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
