import * as service from "./invitacion.service.js";
import { created, ok } from "../../shared/utils/response.js";
import { clienteDe } from "../../shared/utils/cliente.js";

export const enviarInvitacion = async (req, res) => {
  const invitacion = await service.enviarInvitacion(req.params.id_empleado);
  return created(res, invitacion, "Invitación enviada");
};

export const reenviarInvitacion = async (req, res) => {
  const invitacion = await service.reenviarInvitacion(req.params.id_empleado);
  return created(res, invitacion, "Invitación reenviada");
};

export const consultarInvitacion = async (req, res) => {
  return ok(res, await service.consultarInvitacion(req.params.token));
};

export const aceptarInvitacion = async (req, res) => {
  const sesion = await service.aceptarInvitacion(req.params.token, req.body, clienteDe(req));
  return ok(res, sesion, "Invitación aceptada");
};
