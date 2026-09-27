import * as service from "./cita.service.js";
import { ok, created } from "../../shared/utils/response.js";

export const getHorariosLibres = async (req, res) => {
  return ok(res, await service.getHorariosLibres("app", req.query));
};

export const getHorariosLibresPanel = async (req, res) => {
  return ok(res, await service.getHorariosLibres("panel", { ...req.query, id_negocio: req.negocio.id_negocio }));
};

export const createCita = async (req, res) => {
  const cita = await service.crearCitaApp(req.body, { id_usuario: req.user.id_usuario, ip: req.ip });
  return created(res, cita, "Cita solicitada: el negocio debe confirmarla");
};

export const createCitaPanel = async (req, res) => {
  const cita = await service.crearCitaPanel(req.negocio.id_negocio, req.body, {
    id_usuario: req.user.id_usuario,
    id_empleado: req.acceso?.id_empleado ?? null,
    ip: req.ip,
  });
  return created(res, cita, "Cita agendada y confirmada");
};
