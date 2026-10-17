import * as service from "./horario.service.js";
import { ok } from "../../shared/utils/response.js";
import { mensajeConAfectadas } from "../disponibilidad/disponibilidad.service.js";

export const getHorarios = async (req, res) => {
  return ok(res, await service.getHorarios(req.params.id_sucursal));
};

export const replaceHorarios = async (req, res) => {
  const data = await service.replaceHorarios(req.params.id_sucursal, req.body.horarios, req.user.id_usuario);
  return ok(res, data, mensajeConAfectadas("Horarios actualizados", data.citas_afectadas, "del horario de la sede"));
};
