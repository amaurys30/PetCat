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
  try {
    // El token viene del middleware gracias a req.session o req.headers
    const authHeader = req.headers.authorization;
    const token = authHeader.split(" ")[1];

    // Cambiamos el estado en la base de datos
    await sessionRepo.invalidateSession(token);

    return res.status(200).json({ message: "Sesión cerrada exitosamente" });
  } catch (error) {
    return res.status(500).json({ message: "Error al cerrar sesión" });
  }
};
