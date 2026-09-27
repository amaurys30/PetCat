import * as service from "./vacuna.service.js";
import { ok, created } from "../../shared/utils/response.js";

export const getVacunasDueno = async (req, res) => {
  return ok(res, await service.getVacunasDueno(req.user.id_usuario, req.params.id_mascota));
};

export const getVacunasNegocio = async (req, res) => {
  return ok(res, await service.getVacunasNegocio(req.negocio.id_negocio, req.params.id_mascota));
};

export const crearVacunaDueno = async (req, res) => {
  const vacuna = await service.crearVacunaDueno(req.user.id_usuario, req.params.id_mascota, req.body);
  return created(res, vacuna, "Vacuna registrada");
};

export const crearVacunaNegocio = async (req, res) => {
  const vacuna = await service.crearVacunaNegocio(req.negocio, { id_usuario: req.user.id_usuario, acceso: req.acceso }, req.body);
  return created(res, vacuna, "Vacuna registrada");
};

export const actualizarVacuna = async (req, res) => {
  return ok(res, await service.actualizarVacuna(req.params.id_vacuna, req.body, req.acceso), "Vacuna actualizada");
};
