import * as service from "./auth.service.js";
import * as sessionRepo from "../sessions/session.repository.js";
import { ok, created } from "../../shared/utils/response.js";

// Datos del cliente que se guardan con la sesión.
const clienteDe = (req) => ({
  ip: req.ip ?? null,
  userAgent: req.get("user-agent")?.slice(0, 500) ?? null,
});

export const register = async (req, res) => {
  const usuario = await service.register(req.body);
  return created(res, usuario, "Cuenta creada");
};

export const login = async (req, res) => {
  const sesion = await service.login(req.body, clienteDe(req));
  return ok(res, sesion, "Sesión iniciada");
};

export const logout = async (req, res) => {
  await sessionRepo.deactivate(req.session.id_sesion);
  return ok(res, null, "Sesión cerrada");
};
