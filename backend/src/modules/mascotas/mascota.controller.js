import * as service from "./mascota.service.js";
import { ok, created } from "../../shared/utils/response.js";
import { archivoUnico } from "../../shared/utils/uploads.js";

export const getMisMascotas = async (req, res) => {
  return ok(res, await service.getMisMascotas(req.user.id_usuario, req.query));
};

export const getMascota = async (req, res) => {
  return ok(res, await service.getMascota(req.user.id_usuario, req.params.id_mascota, req.query));
};

export const getPesos = async (req, res) => {
  return ok(res, await service.getPesos(req.user.id_usuario, req.params.id_mascota, req.query));
};

export const createMascota = async (req, res) => {
  const mascota = await service.createMascota(req.user.id_usuario, req.body);
  return created(res, mascota, "Mascota registrada");
};

export const updateMascota = async (req, res) => {
  const mascota = await service.updateMascota(req.user.id_usuario, req.params.id_mascota, req.body);
  return ok(res, mascota, "Mascota actualizada");
};

export const subirFoto = async (req, res) => {
  const mascota = await service.subirFoto(req.user.id_usuario, req.params.id_mascota, archivoUnico(req, "mascota_foto"));
  return ok(res, mascota, "Foto de la mascota actualizada");
};

export const eliminarFoto = async (req, res) => {
  const mascota = await service.eliminarFoto(req.user.id_usuario, req.params.id_mascota);
  return ok(res, mascota, "Foto de la mascota eliminada");
};

export const deleteMascota = async (req, res) => {
  await service.deleteMascota(req.user.id_usuario, req.params.id_mascota);
  return ok(res, null, "Mascota eliminada");
};
