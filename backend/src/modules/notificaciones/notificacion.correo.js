import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { escapeHtml } from "../../shared/utils/mailer.js";

/**
 * Correos de notificaciones y baja con un enlace firmado. El token de baja es un JWT con
 * audiencia propia y sin vencimiento: un access token no sirve como token de baja (no
 * tiene esa audiencia) y un token de baja no sirve como access token (no tiene sesión).
 * Solo puede apagar `notif_email` de su usuario.
 */
const AUDIENCIA_BAJA = "baja_correo";

export const tokenBaja = (id_usuario) =>
  jwt.sign({ sub: String(id_usuario) }, env.JWT_SECRET, { audience: AUDIENCIA_BAJA, algorithm: "HS256" });

/** id_usuario del token, o null si no es un token de baja válido. */
export const verificarTokenBaja = (token) => {
  try {
    const { sub } = jwt.verify(String(token ?? ""), env.JWT_SECRET, { audience: AUDIENCIA_BAJA, algorithms: ["HS256"] });
    const id = Number(sub);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
};

export const enlaceBaja = (id_usuario) => `${env.APP_URL}/api/v1/correo/baja?token=${encodeURIComponent(tokenBaja(id_usuario))}`;

/**
 * Correo de una notificación con el enlace para dejar de recibirlos. Incluye las
 * cabeceras List-Unsubscribe (RFC 8058) para que Gmail y Outlook muestren "Anular suscripción".
 */
export const correoNotificacion = ({ id_usuario, nombre, email, asunto, parrafos }) => {
  const baja = enlaceBaja(id_usuario);
  const pie = "Recibes este correo porque tienes activadas las notificaciones por correo de PetCat.";
  const text = [`Hola ${nombre},`, "", ...parrafos.flatMap((p) => [p, ""]), "—", pie, `Dejar de recibir estos correos: ${baja}`].join("\n");
  const html = `
    <p>Hola ${escapeHtml(nombre)},</p>
    ${parrafos.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n    ")}
    <hr>
    <p style="font-size:12px;color:#666">${pie} <a href="${baja}">Dejar de recibir estos correos</a>.</p>`;
  return {
    to: email,
    subject: asunto,
    text,
    html,
    headers: { "List-Unsubscribe": `<${baja}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
};

/** Página HTML mínima (la abre el navegador desde el correo, no la app). */
export const paginaBaja = ({ titulo, mensaje, token }) => `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(titulo)} · PetCat</title></head>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:48px auto;padding:0 16px;color:#222">
  <h1 style="font-size:22px">${escapeHtml(titulo)}</h1>
  <p>${escapeHtml(mensaje)}</p>
  ${
    token
      ? `<form method="post" action="?token=${encodeURIComponent(token)}">
    <button type="submit" style="padding:10px 18px;font-size:16px">Dejar de recibir correos</button>
  </form>`
      : ""
  }
</body>
</html>`;
