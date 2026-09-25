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
 * Opciones de Nodemailer. Los tres tiempos límite usan SMTP_TIMEOUT_MS (10 s por
 * defecto): conexión TCP, saludo del servidor e inactividad del socket.
 */
export const transportOptions = () => ({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  connectionTimeout: env.SMTP_TIMEOUT_MS,
  greetingTimeout: env.SMTP_TIMEOUT_MS,
  socketTimeout: env.SMTP_TIMEOUT_MS,
});

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
 * - Con SMTP_HOST: se envía con Nodemailer.
 *
 * @param {{ to: string, subject: string, text: string, html?: string }} mail
 */
export const sendMail = async ({ to, subject, text, html }) => {
  const mail = { from: env.MAIL_FROM, to, subject, text, html };

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

  const info = await getTransporter().sendMail(mail);
  return { delivered: true, mode: "smtp", messageId: info.messageId };
};
