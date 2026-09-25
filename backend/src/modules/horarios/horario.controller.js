// ===============================
// src/modules/horarios/horario.controller.js
// ===============================

import { createHorarioService } from "./horario.service.js";

export const createHorario = async (req, res) => {
  try {
    const { id_sucursal } = req.params;

    const {
      dia_semana,
      hora_apertura,
      hora_cierre
    } = req.body;

    const usuarioAuth = req.usuario;

    const result = await createHorarioService({
      id_sucursal,
      dia_semana,
      hora_apertura,
      hora_cierre,
      usuarioAuth
    });

    return res.status(201).json({
      ok: true,
      message: "Horario creado correctamente",
      data: result
    });

  } catch (error) {
    console.error("ERROR CREATE HORARIO:", error);

    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "Error interno del servidor"
    });
  }
};