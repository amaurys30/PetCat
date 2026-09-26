import * as service from "./rol.service.js";
import { ok, created } from "../../shared/utils/response.js";

export const getRoles = async (req, res) => {
  return ok(res, await service.getRoles(req.negocio.id_negocio));
};

export const createRol = async (req, res) => {
  const rol = await service.createRol(req.negocio.id_negocio, req.body, req.acceso);
  return created(res, rol, "Rol creado");
};

export const updateRol = async (req, res) => {
  const rol = await service.updateRol(req.params.id_rol, req.body, req.acceso);
  return ok(res, rol, "Rol actualizado");
};

export const deleteRol = async (req, res) => {
  await service.deleteRol(req.params.id_rol, req.acceso);
  return ok(res, null, "Rol eliminado");
};
