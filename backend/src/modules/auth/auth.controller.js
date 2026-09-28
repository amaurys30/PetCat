import * as service from "./auth.service.js";
import * as sessionRepo from "../sessions/session.repository.js";
import { refreshSession } from "../sessions/session.service.js";
import { ok, created } from "../../shared/utils/response.js";
import { clienteDe } from "../../shared/utils/cliente.js";
import { archivoUnico } from "../../shared/utils/uploads.js";

export const register = async (req, res) => {
  const usuario = await service.register(req.body, clienteDe(req));
  return created(res, usuario, "Cuenta creada. Te enviamos un correo para confirmar tu email");
};

export const login = async (req, res) => {
  const sesion = await service.login(req.body, clienteDe(req));
  return ok(res, sesion, "Sesión iniciada");
};

export const logout = async (req, res) => {
  await sessionRepo.deactivate(req.session.id_sesion);
  return ok(res, null, "Sesión cerrada");
};

export const refreshToken = async (req, res) => {
  const sesion = await refreshSession(req.body.refresh_token, clienteDe(req));
  return ok(res, sesion, "Sesión renovada");
};

export const getMe = async (req, res) => {
  return ok(res, await service.getMe(req.user.id_usuario));
};

export const subirFoto = async (req, res) => {
  const perfil = await service.subirFoto(req.user.id_usuario, archivoUnico(req, "usuario_foto"));
  return ok(res, perfil, "Foto de perfil actualizada");
};

export const eliminarFoto = async (req, res) => {
  return ok(res, await service.eliminarFoto(req.user.id_usuario), "Foto de perfil eliminada");
};

export const updateMe = async (req, res) => {
  const perfil = await service.updateMe(req.user.id_usuario, req.body);
  return ok(res, perfil, "Perfil actualizado");
};

export const changePassword = async (req, res) => {
  await service.changePassword(req.user.id_usuario, req.session.id_sesion, req.body);
  return ok(res, null, "Contraseña actualizada. Se cerraron las demás sesiones");
};

export const forgotPassword = async (req, res) => {
  await service.forgotPassword(req.body);
  return ok(res, null, "Si el correo está registrado, te enviamos un enlace para restablecer la contraseña");
};

export const resetPassword = async (req, res) => {
  await service.resetPassword(req.body);
  return ok(res, null, "Contraseña restablecida. Ya puedes iniciar sesión");
};

export const verifyEmail = async (req, res) => {
  await service.verifyEmail(req.params.token);
  return ok(res, null, "Correo verificado");
};

export const resendVerification = async (req, res) => {
  const data = await service.resendVerification(req.user.id_usuario);
  return ok(res, data, "Te enviamos un nuevo enlace de verificación");
};

export const aceptarPolitica = async (req, res) => {
  const { autorizacion, nueva } = await service.aceptarPolitica(req.user.id_usuario, clienteDe(req));
  return ok(res, autorizacion, nueva ? "Política de datos aceptada" : "Ya habías aceptado esta versión de la política");
};
