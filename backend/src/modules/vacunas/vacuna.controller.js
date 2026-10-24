import * as service from "./vacuna.service.js";
import { ok, created } from "../../shared/utils/response.js";
import { archivoUnico } from "../../shared/utils/uploads.js";

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

export const subirComprobante = async (req, res) => {
  const archivo = archivoUnico(req, "vacuna_comprobante");
  const vacuna = await service.subirComprobante(req.params.id_vacuna, req.acceso, req.user.id_usuario, archivo);
  return ok(res, vacuna, "Comprobante guardado");
};

export const eliminarComprobante = async (req, res) => {
  const vacuna = await service.eliminarComprobante(req.params.id_vacuna, req.acceso, req.user.id_usuario);
  return ok(res, vacuna, "Comprobante eliminado");
};

export const actualizarVacuna = async (req, res) => {
  const vacuna = await service.actualizarVacuna(req.params.id_vacuna, req.body, req.acceso, req.user.id_usuario);
  return ok(res, vacuna, "Vacuna actualizada");
};
