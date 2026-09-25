// ===============================
// src/modules/horarios/horario.service.js
// ===============================

import * as horarioRepository from "./horario.repository.js";
import * as sucursalRepository from "../sucursales/sucursal.repository.js";

export const createHorarioService = async ({
  id_sucursal,
  dia_semana,
  hora_apertura,
  hora_cierre,
  usuarioAuth
}) => {

  // ===============================
  // VALIDACIONES OBLIGATORIAS
  // ===============================

  if (
    !id_sucursal ||
    dia_semana === undefined ||
    !hora_apertura ||
    !hora_cierre
  ) {
    const error = new Error(
      "id_sucursal, dia_semana, hora_apertura y hora_cierre son obligatorios"
    );
    error.statusCode = 400;
    throw error;
  }

  // Validar id_sucursal numérico
  if (isNaN(id_sucursal)) {
    const error = new Error(
      "id_sucursal debe ser un número válido"
    );
    error.statusCode = 400;
    throw error;
  }

  // Día válido (0-6)
  if (dia_semana < 0 || dia_semana > 6) {
    const error = new Error(
      "dia_semana debe estar entre 0 (domingo) y 6 (sábado)"
    );
    error.statusCode = 400;
    throw error;
  }

  // Validar rango horario
  if (hora_cierre <= hora_apertura) {
    const error = new Error(
      "hora_cierre debe ser mayor que hora_apertura"
    );
    error.statusCode = 400;
    throw error;
  }

  // ===============================
  // VALIDAR SUCURSAL EXISTE
  // ===============================

  const sucursal = await sucursalRepository.findById(id_sucursal);

  if (!sucursal) {
    const error = new Error(
      "La sucursal no existe"
    );
    error.statusCode = 404;
    throw error;
  }

  // ===============================
  // VALIDAR DUPLICADO
  // ===============================

  const horarioExistente =
    await horarioRepository.findBySucursalAndDia(
      id_sucursal,
      dia_semana
    );

  if (horarioExistente) {
    const error = new Error(
      "Ya existe un horario registrado para ese día en esta sucursal"
    );
    error.statusCode = 409;
    throw error;
  }

  // ===============================
  // CREAR HORARIO
  // ===============================

  const newHorario = await horarioRepository.create({
    id_sucursal,
    dia_semana,
    hora_apertura,
    hora_cierre
  });

  return newHorario;
};