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

// ---------- Dominios reservados ----------

/**
 * Dominios que no existen ni reciben correo (RFC 2606 y 6761): los de nivel superior .test,
 * .example, .invalid y .localhost, y example.com/.net/.org (con sus subdominios). El seed usa
 * @petcat.test: con un SMTP real, cada envío a esas direcciones rebotaría, y muchos rebotes
 * dañan la reputación de la cuenta que envía (Gmail, por ejemplo).
 */
const TLD_RESERVADOS = new Set(["test", "example", "invalid", "localhost"]);
const DOMINIOS_RESERVADOS = ["example.com", "example.net", "example.org"];

/** Dominio de una dirección ("Ana <ana@x.co>" o "ana@x.co"), en minúsculas y sin punto final. */
const dominioDe = (direccion) => {
  const email = /<([^>]+)>/.exec(direccion)?.[1] ?? direccion;
  const arroba = email.lastIndexOf("@");
  return arroba < 0 ? "" : email.slice(arroba + 1).trim().toLowerCase().replace(/\.$/, "");
};

/** true si la dirección es de un dominio reservado que no recibe correo. */
export const esDominioReservado = (direccion) => {
  const dominio = dominioDe(String(direccion));
  if (!dominio) return false;
  if (TLD_RESERVADOS.has(dominio.split(".").at(-1))) return true;
  return DOMINIOS_RESERVADOS.some((d) => dominio === d || dominio.endsWith(`.${d}`));
};

/** Servidores locales que atrapan el correo sin enviarlo (Mailpit en Docker o en el host). */
const SERVIDORES_LOCALES = new Set(["mailpit", "localhost", "127.0.0.1", "::1"]);

/**
 * true si el SMTP configurado envía de verdad a internet (Gmail u otro proveedor). Mailpit no:
 * ahí los correos a @petcat.test se siguen viendo (la API de demo y los códigos de la app).
 */
export const esEnvioReal = (config = env) =>
  Boolean(config.SMTP_HOST) && !SERVIDORES_LOCALES.has(config.SMTP_HOST.trim().toLowerCase());

/** "c•••@petcat.test": el registro no lleva la dirección completa. */
const direccionTapada = (direccion) => {
  const email = /<([^>]+)>/.exec(direccion)?.[1] ?? direccion;
  const [local = "", dominio = ""] = email.split("@");
  return `${local.slice(0, 1)}•••@${dominio}`;
};

let transporter;

const getTransporter = () => {
  transporter ??= nodemailer.createTransport(transportOptions());
  return transporter;
};

/**
 * Crea la función que envía los correos con esa configuración. `sendMail` es la de la app;
 * los tests crean otras con un transporte falso para comprobar qué llega al SMTP.
 */
export const crearEnviador = ({ config = env, enTests = isTest, transporte = getTransporter, registro = console } = {}) =>
  async ({ to, subject, text, html, headers, ocultarEnConsola = [] }) => {
    const mail = { from: config.MAIL_FROM, to, subject, text, html, ...(headers && { headers }) };

    if (enTests) {
      outbox.push(mail);
      return { delivered: false, mode: "test" };
    }

    // Con un SMTP real, nunca a un dominio reservado: no se envía y queda en el registro.
    if (esEnvioReal(config)) {
      const destinatarios = String(to)
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      const reservados = destinatarios.filter(esDominioReservado);
      if (reservados.length > 0) {
        registro.warn(
          `[correo] No enviado a ${reservados.map(direccionTapada).join(", ")}: dominio reservado que no recibe correo (asunto: "${subject}").`
        );
        const validos = destinatarios.filter((d) => !esDominioReservado(d));
        if (validos.length === 0) return { delivered: false, mode: "bloqueado" };
        mail.to = validos.join(", ");
      }
    }

    return entregar(mail, { config, transporte, registro, ocultarEnConsola });
  };

const entregar = async (mail, { config, transporte, registro, ocultarEnConsola }) => {
  const { to, subject, text } = mail;
  if (!config.SMTP_HOST) {
    registro.log(
      [
        "",
        "---- Correo (sin SMTP configurado) ----",
        `Para:   ${to}`,
        `Asunto: ${subject}`,
        "",
        textoParaConsola(text, ocultarEnConsola),
        "--------------------------------------",
        "",
      ].join("\n")
    );
    return { delivered: false, mode: "console" };
  }

  try {
    const info = await transporte().sendMail(mail);
    return { delivered: true, mode: "smtp", messageId: info.messageId };
  } catch (err) {
    // Quien lo registra (console.error de cada envío) muestra la causa en palabras claras.
    err.message = `${explicarErrorSmtp(err, config)} [${err.message}]`;
    throw err;
  }
};

/**
 * Envía un correo. Incluir siempre `text` (con el enlace, si lo hay): es lo que
 * se muestra en consola cuando no hay SMTP y lo que leen los clientes sin HTML.
 * - Tests: se guarda en `outbox`.
 * - Con un SMTP real (no Mailpit): a los dominios reservados (.test, example.com...) no se
 *   envía; queda un aviso en el registro y devuelve `mode: "bloqueado"`.
 * - Sin SMTP_HOST (solo desarrollo; en producción env.js lo exige): se muestra en consola.
 * - Con SMTP_HOST: se envía con Nodemailer. Si falla, el mensaje del error lleva la causa
 *   explicada (explicarErrorSmtp) y el original entre corchetes.
 * Todos los correos pasan por aquí: auth, invitaciones y notificaciones (también las de las
 * tareas programadas).
 *
 * @param {{ to: string, subject: string, text: string, html?: string, headers?: Record<string, string>, ocultarEnConsola?: string[] }} mail
 *   `headers`: cabeceras adicionales (p. ej. List-Unsubscribe en los correos de notificaciones).
 *   `ocultarEnConsola`: secretos que el modo consola tapa (códigos de 6 dígitos): nunca a un log.
 */
export const sendMail = (mail) => crearEnviador()(mail);

/**
 * Texto del correo para la consola, con los secretos tapados. Si tapó alguno, avisa
 * dónde verlo (Mailpit muestra el correo completo; ver "Correo" en backend/README.md).
 */
export const textoParaConsola = (text, ocultar = []) => {
  const secretos = ocultar.filter(Boolean);
  if (secretos.length === 0) return text;
  const tapado = secretos.reduce((acc, secreto) => acc.split(secreto).join("••••••"), text);
  return `${tapado}\n\n(Código oculto en la consola: usa Mailpit para verlo, o el enlace del correo.)`;
};

/** Escapa texto para insertarlo en el HTML de un correo. */
export const escapeHtml = (texto) =>
  String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
