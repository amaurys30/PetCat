import * as service from "./notificacion.service.js";
import { paginaBaja, verificarTokenBaja } from "./notificacion.correo.js";
import { ok, paginated } from "../../shared/utils/response.js";

export const getNotificaciones = async (req, res) => {
  const { rows, meta } = await service.getNotificaciones(req.user.id_usuario, req.query);
  return paginated(res, rows, meta);
};

export const getNoLeidas = async (req, res) => {
  return ok(res, await service.getNoLeidas(req.user.id_usuario));
};

export const marcarLeida = async (req, res) => {
  return ok(res, await service.marcarLeida(req.user.id_usuario, req.params.id_notificacion), "Notificación leída");
};

export const marcarTodasLeidas = async (req, res) => {
  return ok(res, await service.marcarTodasLeidas(req.user.id_usuario), "Notificaciones leídas");
};

// La baja de correos se abre desde un correo en el navegador: responde HTML, no JSON.
const html = (res, status, pagina) => res.status(status).type("html").send(pagina);

const ENLACE_INVALIDO = {
  titulo: "Enlace no válido",
  mensaje: "El enlace para dejar de recibir correos no es válido. Puedes desactivarlos desde la app de PetCat.",
};

export const confirmarBaja = async (req, res) => {
  if (!verificarTokenBaja(req.query.token)) return html(res, 400, paginaBaja(ENLACE_INVALIDO));
  return html(
    res,
    200,
    paginaBaja({
      titulo: "Dejar de recibir correos",
      mensaje: "Ya no recibirás correos con avisos de tus citas. Las notificaciones dentro de la app siguen igual.",
      token: req.query.token,
    })
  );
};

/** POST del botón de la página y "anular suscripción con un clic" de Gmail/Outlook (RFC 8058). */
export const darDeBaja = async (req, res) => {
  const id_usuario = verificarTokenBaja(req.query.token);
  if (!id_usuario) return html(res, 400, paginaBaja(ENLACE_INVALIDO));
  await service.darDeBajaCorreos(id_usuario);
  return html(
    res,
    200,
    paginaBaja({
      titulo: "Listo",
      mensaje: "Ya no recibirás correos de notificaciones de PetCat. Puedes volver a activarlos en tu perfil de la app.",
    })
  );
};
