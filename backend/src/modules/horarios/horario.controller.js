import * as service from "./horario.service.js";
import { ok } from "../../shared/utils/response.js";

export const getHorarios = async (req, res) => {
  return ok(res, await service.getHorarios(req.params.id_sucursal));
};

export const replaceHorarios = async (req, res) => {
  const horarios = await service.replaceHorarios(req.params.id_sucursal, req.body.horarios);
  return ok(res, horarios, "Horarios actualizados");
};
