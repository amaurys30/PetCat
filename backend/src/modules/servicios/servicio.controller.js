import * as service from "./servicio.service.js";
import { getServicioPublico as getPublico } from "../busqueda/busqueda.service.js";
import { ok, created, paginated } from "../../shared/utils/response.js";

export const getCategorias = async (req, res) => {
  return ok(res, await service.getCategorias());
};

export const getServicios = async (req, res) => {
  const { rows, meta } = await service.getServicios(req.negocio.id_negocio, req.query);
  return paginated(res, rows, meta);
};

export const createServicio = async (req, res) => {
  const servicio = await service.createServicio(req.negocio.id_negocio, req.body);
  return created(res, servicio, "Servicio creado");
};

export const getServicioPublico = async (req, res) => {
  return ok(res, await getPublico(req.params.id_servicio));
};

export const updateServicio = async (req, res) => {
  const servicio = await service.updateServicio(req.params.id_servicio, req.body);
  return ok(res, servicio, "Servicio actualizado");
};

export const deleteServicio = async (req, res) => {
  await service.deleteServicio(req.params.id_servicio);
  return ok(res, null, "Servicio eliminado");
};

export const reactivarServicio = async (req, res) => {
  const servicio = await service.reactivarServicio(req.params.id_servicio);
  return ok(res, servicio, "Servicio reactivado");
};
