import * as service from "./mascota.service.js";
import { ok, created } from "../../shared/utils/response.js";

export const getMisMascotas = async (req, res) => {
  return ok(res, await service.getMisMascotas(req.user.id_usuario));
};

export const getMascota = async (req, res) => {
  return ok(res, await service.getMascota(req.user.id_usuario, req.params.id_mascota));
};

export const createMascota = async (req, res) => {
  const mascota = await service.createMascota(req.user.id_usuario, req.body);
  return created(res, mascota, "Mascota registrada");
};

export const updateMascota = async (req, res) => {
  const mascota = await service.updateMascota(req.user.id_usuario, req.params.id_mascota, req.body);
  return ok(res, mascota, "Mascota actualizada");
};

export const deleteMascota = async (req, res) => {
  await service.deleteMascota(req.user.id_usuario, req.params.id_mascota);
  return ok(res, null, "Mascota eliminada");
};
