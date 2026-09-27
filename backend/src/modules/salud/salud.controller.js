import * as service from "./salud.service.js";
import { ok } from "../../shared/utils/response.js";

export const getResumenDueno = async (req, res) => {
  return ok(res, await service.getResumenDueno(req.user.id_usuario, req.params.id_mascota));
};

export const getResumenNegocio = async (req, res) => {
  return ok(res, await service.getResumenNegocio(req.negocio.id_negocio, req.params.id_mascota));
};
