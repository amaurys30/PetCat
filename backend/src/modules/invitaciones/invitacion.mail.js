import { env } from "../../config/env.js";

const escapeHtml = (texto) =>
  String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Enlace del panel para aceptar: lleva el token real (en la base solo está su hash). */
export const enlaceInvitacion = (token) => `${env.FRONTEND_URL}/invitacion/${token}`;

/**
 * Correo de invitación. `expiracion` viene de MySQL ("YYYY-MM-DD HH:MM:SS", hora de Bogotá).
 */
export const correoInvitacion = ({ token, email, nombre, negocio, rol, expiracion }) => {
  const enlace = enlaceInvitacion(token);
  const vence = expiracion.slice(0, 16);
  const subject = `${negocio} te invita a su equipo en PetCat`;
  const text = [
    `Hola ${nombre},`,
    "",
    `${negocio} te invitó a unirte a su equipo en PetCat con el rol ${rol}.`,
    "Para aceptar la invitación, abre este enlace:",
    "",
    enlace,
    "",
    `El enlace vence el ${vence} (hora de Colombia). Si no esperabas este correo, puedes ignorarlo.`,
  ].join("\n");
  const html = `
    <p>Hola ${escapeHtml(nombre)},</p>
    <p><strong>${escapeHtml(negocio)}</strong> te invitó a unirte a su equipo en PetCat con el rol
       <strong>${escapeHtml(rol)}</strong>.</p>
    <p><a href="${enlace}">Aceptar la invitación</a></p>
    <p>El enlace vence el ${vence} (hora de Colombia). Si no esperabas este correo, puedes ignorarlo.</p>`;
  return { to: email, subject, text, html };
};
