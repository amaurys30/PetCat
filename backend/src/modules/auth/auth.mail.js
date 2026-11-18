import { env } from "../../config/env.js";
import { escapeHtml } from "../../shared/utils/mailer.js";
import { MINUTOS_CODIGO } from "./codigo.service.js";

// Los enlaces llevan el token real (en la base solo está su hash) y abren el frontend,
// que llama a la API: GET /auth/verify-email/:token y POST /auth/reset-password.
// El código de 6 dígitos es para la app móvil (POST /auth/verify-email/codigo y
// POST /auth/reset-password/codigo). Va en `ocultarEnConsola`: el modo consola del mailer
// lo tapa, para que nunca quede en un log.
export const enlaceVerificacion = (token) => `${env.FRONTEND_URL}/verificar-email/${token}`;
export const enlaceRecuperacion = (token) => `${env.FRONTEND_URL}/restablecer-password/${token}`;

const lineaCodigo = (codigo) =>
  `Si estás en la app de PetCat, escribe este código: ${codigo} (vence en ${MINUTOS_CODIGO} minutos).`;

const bloqueCodigo = (codigo) => `
    <p>Si estás en la app de PetCat, escribe este código (vence en ${MINUTOS_CODIGO} minutos):</p>
    <p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:8px 0">${escapeHtml(codigo)}</p>`;

/** 60 -> "1 hora", 1440 -> "24 horas", 10080 -> "7 días". */
const vigenciaTexto = (minutos) => {
  if (minutos > 1440 && minutos % 1440 === 0) return `${minutos / 1440} días`;
  if (minutos % 60 === 0) return `${minutos / 60} ${minutos === 60 ? "hora" : "horas"}`;
  return `${minutos} minutos`;
};

export const correoVerificacion = ({ token, codigo, email, nombre, minutos }) => {
  const enlace = enlaceVerificacion(token);
  const vigencia = vigenciaTexto(minutos);
  const subject = "Confirma tu correo en PetCat";
  const text = [
    `Hola ${nombre},`,
    "",
    lineaCodigo(codigo),
    "",
    "También puedes confirmar tu correo abriendo este enlace:",
    "",
    enlace,
    "",
    `El enlace vence en ${vigencia}. Si no creaste una cuenta en PetCat, puedes ignorar este correo.`,
  ].join("\n");
  const html = `
    <p>Hola ${escapeHtml(nombre)},</p>${bloqueCodigo(codigo)}
    <p>También puedes confirmar tu correo abriendo este enlace:</p>
    <p><a href="${enlace}">Confirmar mi correo</a></p>
    <p>El enlace vence en ${vigencia}. Si no creaste una cuenta en PetCat, puedes ignorar este correo.</p>`;
  return { to: email, subject, text, html, ocultarEnConsola: [codigo] };
};

export const correoRecuperacion = ({ token, codigo, email, nombre, minutos }) => {
  const enlace = enlaceRecuperacion(token);
  const vigencia = vigenciaTexto(minutos);
  const subject = "Restablece tu contraseña de PetCat";
  const text = [
    `Hola ${nombre},`,
    "",
    "Recibimos una solicitud para restablecer la contraseña de tu cuenta en PetCat.",
    "",
    lineaCodigo(codigo),
    "",
    "También puedes elegir una nueva abriendo este enlace:",
    "",
    enlace,
    "",
    `El enlace vence en ${vigencia}. Si no lo pediste, ignora este correo: tu contraseña no cambia.`,
  ].join("\n");
  const html = `
    <p>Hola ${escapeHtml(nombre)},</p>
    <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en PetCat.</p>${bloqueCodigo(codigo)}
    <p>También puedes elegir una nueva abriendo este enlace:</p>
    <p><a href="${enlace}">Elegir una nueva contraseña</a></p>
    <p>El enlace vence en ${vigencia}. Si no lo pediste, ignora este correo: tu contraseña no cambia.</p>`;
  return { to: email, subject, text, html, ocultarEnConsola: [codigo] };
};

// Cliente registrado por un negocio: crea su contraseña con el mismo flujo de
// restablecer (POST /auth/reset-password), desde otra pantalla del frontend.
export const enlaceCrearPassword = (token) => `${env.FRONTEND_URL}/crear-password/${token}`;

export const correoBienvenida = ({ token, email, nombre, negocio, minutos, politicaUrl, soporte }) => {
  const enlace = enlaceCrearPassword(token);
  const vigencia = vigenciaTexto(minutos);
  // Sin soporte_email configurado, el cliente acude al negocio que lo registró.
  const noReconoces = soporte ? `escríbenos a ${soporte}` : `comunícate con ${negocio}`;
  const subject = `${negocio} te registró en PetCat`;
  const text = [
    `Hola ${nombre},`,
    "",
    `${negocio} te registró en PetCat, la plataforma que usa para agendar tus citas y llevar el historial de tus mascotas.`,
    "Con tu autorización guardamos tu nombre, correo, teléfono y los datos de tu mascota para gestionar sus citas, recordatorios e historial.",
    ...(politicaUrl ? [`Puedes consultar la política de tratamiento de datos en ${politicaUrl}`] : []),
    "",
    "Para entrar a tu cuenta, crea tu contraseña con este enlace:",
    "",
    enlace,
    "",
    `El enlace vence en ${vigencia}. Después puedes usar "Olvidé mi contraseña" en la app.`,
    `Si no reconoces este registro, ${noReconoces}.`,
  ].join("\n");
  const html = `
    <p>Hola ${escapeHtml(nombre)},</p>
    <p><strong>${escapeHtml(negocio)}</strong> te registró en PetCat, la plataforma que usa para agendar tus citas y llevar el historial de tus mascotas.</p>
    <p>Con tu autorización guardamos tu nombre, correo, teléfono y los datos de tu mascota para gestionar sus citas, recordatorios e historial.
       ${politicaUrl ? `Consulta la <a href="${escapeHtml(politicaUrl)}">política de tratamiento de datos</a>.` : ""}</p>
    <p><a href="${enlace}">Crear mi contraseña</a></p>
    <p>El enlace vence en ${vigencia}. Después puedes usar "Olvidé mi contraseña" en la app.
       Si no reconoces este registro, ${escapeHtml(noReconoces)}.</p>`;
  return { to: email, subject, text, html };
};
