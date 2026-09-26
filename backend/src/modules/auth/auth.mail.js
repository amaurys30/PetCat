import { env } from "../../config/env.js";
import { escapeHtml } from "../../shared/utils/mailer.js";

// Los enlaces llevan el token real (en la base solo está su hash) y abren el frontend,
// que llama a la API: GET /auth/verify-email/:token y POST /auth/reset-password.
export const enlaceVerificacion = (token) => `${env.FRONTEND_URL}/verificar-email/${token}`;
export const enlaceRecuperacion = (token) => `${env.FRONTEND_URL}/restablecer-password/${token}`;

const vigenciaTexto = (minutos) =>
  minutos % 60 === 0 ? `${minutos / 60} ${minutos === 60 ? "hora" : "horas"}` : `${minutos} minutos`;

export const correoVerificacion = ({ token, email, nombre, minutos }) => {
  const enlace = enlaceVerificacion(token);
  const vigencia = vigenciaTexto(minutos);
  const subject = "Confirma tu correo en PetCat";
  const text = [
    `Hola ${nombre},`,
    "",
    "Para confirmar tu correo en PetCat, abre este enlace:",
    "",
    enlace,
    "",
    `El enlace vence en ${vigencia}. Si no creaste una cuenta en PetCat, puedes ignorar este correo.`,
  ].join("\n");
  const html = `
    <p>Hola ${escapeHtml(nombre)},</p>
    <p>Para confirmar tu correo en PetCat, abre este enlace:</p>
    <p><a href="${enlace}">Confirmar mi correo</a></p>
    <p>El enlace vence en ${vigencia}. Si no creaste una cuenta en PetCat, puedes ignorar este correo.</p>`;
  return { to: email, subject, text, html };
};

export const correoRecuperacion = ({ token, email, nombre, minutos }) => {
  const enlace = enlaceRecuperacion(token);
  const vigencia = vigenciaTexto(minutos);
  const subject = "Restablece tu contraseña de PetCat";
  const text = [
    `Hola ${nombre},`,
    "",
    "Recibimos una solicitud para restablecer la contraseña de tu cuenta en PetCat.",
    "Para elegir una nueva, abre este enlace:",
    "",
    enlace,
    "",
    `El enlace vence en ${vigencia}. Si no lo pediste, ignora este correo: tu contraseña no cambia.`,
  ].join("\n");
  const html = `
    <p>Hola ${escapeHtml(nombre)},</p>
    <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en PetCat.</p>
    <p><a href="${enlace}">Elegir una nueva contraseña</a></p>
    <p>El enlace vence en ${vigencia}. Si no lo pediste, ignora este correo: tu contraseña no cambia.</p>`;
  return { to: email, subject, text, html };
};
