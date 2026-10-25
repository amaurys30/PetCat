import * as service from "./suscripcion.service.js";
import { ok, created } from "../../shared/utils/response.js";

export const getPlanes = async (req, res) => {
  return ok(res, await service.getPlanes());
};

export const getSuscripcion = async (req, res) => {
  return ok(res, await service.getSuscripcion(req.negocio.id_negocio));
};

export const iniciarPrueba = async (req, res) => {
  const suscripcion = await service.iniciarPrueba(req.negocio.id_negocio, req.acceso, req.user.id_usuario);
  return created(res, suscripcion, "Prueba del plan Pro activada");
};

export const asignarPlan = async (req, res) => {
  const suscripcion = await service.asignarPlan(req.params.id_negocio, req.body, {
    id_usuario: req.user.id_usuario,
    ip: req.ip,
    user_agent: req.get("user-agent"),
  });
  return ok(res, suscripcion, "Plan asignado");
};
