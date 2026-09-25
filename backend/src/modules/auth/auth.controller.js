import * as service from "./auth.service.js";
import * as sessionRepo from "../sessions/session.repository.js";
import { ok, created } from "../../shared/utils/response.js";
import { clienteDe } from "../../shared/utils/cliente.js";

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
