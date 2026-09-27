import * as service from "./historial.service.js";
import { ok, created, paginated } from "../../shared/utils/response.js";

export const getHistorialDueno = async (req, res) => {
  const { rows, meta } = await service.getHistorialDueno(req.user.id_usuario, req.params.id_mascota, req.query);
  return paginated(res, rows, meta);
};

export const getHistorialNegocio = async (req, res) => {
  const { rows, meta } = await service.getHistorialNegocio(req.negocio.id_negocio, req.params.id_mascota, req.query);
  return paginated(res, rows, meta);
};

export const crearRegistro = async (req, res) => {
  const registro = await service.crearRegistro(req.negocio, { id_usuario: req.user.id_usuario, acceso: req.acceso }, req.body);
  return created(res, registro, "Registro de historial creado");
};

export const actualizarRegistro = async (req, res) => {
  return ok(res, await service.actualizarRegistro(req.params.id_historial, req.negocio, req.body), "Registro actualizado");
};
