import * as service from "./cita.service.js";
import * as cambios from "./cita.cambios.js";
import { ok, created, paginated } from "../../shared/utils/response.js";

export const getHorariosLibres = async (req, res) => {
  return ok(res, await service.getHorariosLibres("app", req.query));
};

export const getHorariosLibresPanel = async (req, res) => {
  return ok(res, await service.getHorariosLibres("panel", { ...req.query, id_negocio: req.negocio.id_negocio }));
};

export const createCita = async (req, res) => {
  const cita = await service.crearCitaApp(req.body, { id_usuario: req.user.id_usuario, ip: req.ip });
  return created(res, cita, cita.estado === "confirmada" ? "Cita confirmada" : "Cita solicitada: el negocio debe confirmarla");
};

export const createCitaPanel = async (req, res) => {
  const cita = await service.crearCitaPanel(req.negocio.id_negocio, req.body, {
    id_usuario: req.user.id_usuario,
    id_empleado: req.acceso?.id_empleado ?? null,
    ip: req.ip,
  });
  return created(res, cita, "Cita agendada y confirmada");
};

export const getMisCitas = async (req, res) => {
  const { rows, meta } = await service.getMisCitas(req.user.id_usuario, req.query);
  return paginated(res, rows, meta);
};

export const getAgenda = async (req, res) => {
  const { rows, meta } = await service.getAgenda(req.negocio, req.acceso, req.user.id_usuario, req.query);
  return paginated(res, rows, meta);
};

export const getAtencion = async (req, res) => {
  return ok(res, await service.getAtencion(req.negocio, req.acceso, req.user.id_usuario, req.query));
};

export const getCita = async (req, res) => {
  return ok(res, await service.getCita(req.params.id_cita, req.acceso));
};

/** Quién hace el cambio, para el historial. */
const actorDe = (req) => ({ id_usuario: req.user.id_usuario, id_empleado: req.acceso?.id_empleado ?? null, ip: req.ip });

const MENSAJE_ESTADO = {
  confirmada: "Cita confirmada",
  en_curso: "Cita en curso",
  no_asistio: "Inasistencia registrada",
  completada: "Cita completada",
};

export const cambiarEstado = async (req, res) => {
  const cita = await cambios.cambiarEstado(req.params.id_cita, req.body, actorDe(req), req.acceso);
  return ok(res, cita, MENSAJE_ESTADO[cita.estado]);
};

export const cancelarCita = async (req, res) => {
  const cita = await cambios.cancelarCita(req.params.id_cita, req.body, actorDe(req), req.acceso);
  return ok(res, cita, cita.cancelacion?.tardia ? "Cita cancelada (cancelación tardía)" : "Cita cancelada");
};

export const reprogramarCita = async (req, res) => {
  const cita = await cambios.reprogramarCita(req.params.id_cita, req.body, actorDe(req), req.acceso);
  return created(res, cita, cita.estado === "pendiente" ? "Cita reprogramada: el negocio debe confirmarla" : "Cita reprogramada");
};

export const actualizarCita = async (req, res) => {
  return ok(res, await cambios.actualizarCita(req.params.id_cita, req.body, actorDe(req), req.acceso), "Cita actualizada");
};

export const getHistorial = async (req, res) => {
  return ok(res, await cambios.getHistorial(req.params.id_cita, req.acceso));
};
