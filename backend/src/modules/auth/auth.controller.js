import * as service from "./auth.service.js";
import * as sessionRepo from "../sessions/session.repository.js";

export const register = async (req, res) => {
  try {
    const user = await service.register(req.body);

    return res.status(201).json({
      ok: true,
      message: "Usuario creado exitosamente",
      data: user,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      message: error.message,
    });
  }
};

export const login = async (req, res) => {
  try {
    const result = await service.login(req.body.email, req.body.password);

    return res.status(200).json({
      ok: true,
      message: "Login exitoso",
      ...result,
    });
  } catch (error) {
    return res.status(401).json({
      ok: false,
      message: error.message,
    });
  }
};


export const logout = async (req, res) => {
  await sessionRepo.deactivate(req.session.id_sesion);
  return res.status(200).json({ success: true, message: "Sesión cerrada", data: null });
};
