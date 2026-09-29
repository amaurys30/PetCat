import * as service from "./dispositivo.service.js";
import { ok, created } from "../../shared/utils/response.js";

export const registrar = async (req, res) => {
  const { dispositivo, nuevo } = await service.registrar(req.user.id_usuario, req.session.id_sesion, req.body);
  return nuevo ? created(res, dispositivo, "Dispositivo registrado") : ok(res, dispositivo, "Dispositivo actualizado");
};

export const quitar = async (req, res) => {
  await service.quitar(req.user.id_usuario, req.body.token_expo);
  return ok(res, null, "Dispositivo eliminado");
};
