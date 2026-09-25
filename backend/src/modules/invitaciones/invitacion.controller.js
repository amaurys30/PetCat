import * as service from "./invitacion.service.js";
import { created } from "../../shared/utils/response.js";

export const enviarInvitacion = async (req, res) => {
  const invitacion = await service.enviarInvitacion(req.params.id_empleado);
  return created(res, invitacion, "Invitación enviada");
};

export const reenviarInvitacion = async (req, res) => {
  const invitacion = await service.reenviarInvitacion(req.params.id_empleado);
  return created(res, invitacion, "Invitación reenviada");
};
