import * as service from "./empleado.service.js";
import { ok, created, paginated } from "../../shared/utils/response.js";

export const getEmpleados = async (req, res) => {
  const { rows, meta } = await service.getEmpleados(req.negocio.id_negocio, req.query);
  return paginated(res, rows, meta);
};

export const getEmpleado = async (req, res) => {
  return ok(res, await service.getEmpleado(req.params.id_empleado));
};

export const createEmpleado = async (req, res) => {
  const empleado = await service.createEmpleado(req.negocio.id_negocio, req.body);
  return created(res, empleado, "Empleado creado");
};

export const updateEmpleado = async (req, res) => {
  const empleado = await service.updateEmpleado(req.params.id_empleado, req.body);
  return ok(res, empleado, "Empleado actualizado");
};

export const desactivarEmpleado = async (req, res) => {
  const empleado = await service.desactivarEmpleado(req.params.id_empleado);
  return ok(res, empleado, "Empleado desactivado");
};

export const reactivarEmpleado = async (req, res) => {
  const empleado = await service.reactivarEmpleado(req.params.id_empleado);
  return ok(res, empleado, "Empleado reactivado");
};
