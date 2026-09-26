import * as service from "./sucursal.service.js";
import { ok, created } from "../../shared/utils/response.js";

export const getSucursalesPublicas = async (req, res) => {
  return ok(res, await service.getSucursalesPublicas(req.params.id_negocio));
};

export const getSucursalPublica = async (req, res) => {
  return ok(res, await service.getSucursalPublica(req.params.id_sucursal));
};

export const createSucursal = async (req, res) => {
  const sucursal = await service.createSucursal(req.negocio.id_negocio, req.body);
  return created(res, sucursal, "Sucursal creada");
};

export const updateSucursal = async (req, res) => {
  const sucursal = await service.updateSucursal(req.params.id_sucursal, req.body);
  return ok(res, sucursal, "Sucursal actualizada");
};

export const deleteSucursal = async (req, res) => {
  await service.deleteSucursal(req.params.id_sucursal);
  return ok(res, null, "Sucursal eliminada");
};
