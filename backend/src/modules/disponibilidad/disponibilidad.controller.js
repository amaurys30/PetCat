import * as service from "./disponibilidad.service.js";
import { ok, created } from "../../shared/utils/response.js";

export const getDisponibilidad = async (req, res) => {
  return ok(res, await service.getDisponibilidad(req.params.id_empleado, req.query));
};

export const getDisponibilidadEfectiva = async (req, res) => {
  return ok(res, await service.getDisponibilidadEfectiva(req.params.id_empleado, req.query));
};

export const replaceHorarioSemanal = async (req, res) => {
  const data = await service.replaceHorarioSemanal(req.params.id_empleado, req.body.horarios);
  return ok(res, data, service.mensajeConAfectadas("Horario semanal actualizado", data.citas_afectadas));
};

export const createExcepcion = async (req, res) => {
  const { mensaje, ...data } = await service.createExcepcion(req.params.id_empleado, req.body);
  return created(res, data, mensaje);
};

export const updateExcepcion = async (req, res) => {
  const { mensaje, ...data } = await service.updateExcepcion(req.params.id_disponibilidad, req.body);
  return ok(res, data, mensaje);
};

export const deleteExcepcion = async (req, res) => {
  const { mensaje, ...data } = await service.deleteExcepcion(req.params.id_disponibilidad);
  return ok(res, data, mensaje);
};
