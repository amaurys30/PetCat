import * as service from "./negocio.service.js";
import { ok, created } from "../../shared/utils/response.js";

export const createNegocio = async (req, res) => {
  const negocio = await service.createNegocio(req.user.id_usuario, req.body);
  return created(res, negocio, "Negocio creado");
};

export const getMisNegocios = async (req, res) => {
  return ok(res, await service.getMisNegocios(req.user.id_usuario));
};

export const getPerfilPublico = async (req, res) => {
  return ok(res, await service.getPerfilPublico(req.params.id_negocio));
};

export const updateNegocio = async (req, res) => {
  const negocio = await service.updateNegocio(req.negocio.id_negocio, req.body);
  return ok(res, negocio, "Negocio actualizado");
};
