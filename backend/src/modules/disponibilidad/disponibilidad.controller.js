import * as service from "./disponibilidad.service.js";
import { ok, created } from "../../shared/utils/response.js";
import { accesoPermite } from "../../shared/utils/permissions.js";

export const getDisponibilidad = async (req, res) => {
  // El motivo puede ser personal: lo ven quien gestiona la configuración y el propio empleado.
  const verMotivo =
    accesoPermite(req.acceso, "configuracion", "ver") || req.acceso.id_empleado === req.params.id_empleado;
  return ok(res, await service.getDisponibilidad(req.params.id_empleado, req.query, { verMotivo }));
};

export const getDisponibilidadEfectiva = async (req, res) => {
  return ok(res, await service.getDisponibilidadEfectiva(req.params.id_empleado, req.query));
};

export const replaceHorarioSemanal = async (req, res) => {
  const data = await service.replaceHorarioSemanal(req.params.id_empleado, req.body.horarios, req.user.id_usuario);
  return ok(res, data, service.mensajeConAfectadas("Horario semanal actualizado", data.citas_afectadas));
};

export const createExcepcion = async (req, res) => {
  const { mensaje, ...data } = await service.createExcepcion(req.params.id_empleado, req.body, req.user.id_usuario);
  return created(res, data, mensaje);
};

export const updateExcepcion = async (req, res) => {
  const { mensaje, ...data } = await service.updateExcepcion(req.params.id_disponibilidad, req.body, req.user.id_usuario);
  return ok(res, data, mensaje);
};

export const deleteExcepcion = async (req, res) => {
  const { mensaje, ...data } = await service.deleteExcepcion(req.params.id_disponibilidad, req.user.id_usuario);
  return ok(res, data, mensaje);
};
