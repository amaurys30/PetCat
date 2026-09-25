// ================================
// modules/roles/rol.service.js
// ================================

import * as negocioRepository from "../negocios/negocio.repository.js";
import * as rolRepository from "./rol.repository.js";

export const createRol = async ({
  id_negocio,
  nombre,
  descripcion,
  permisos_json
}) => {
  // 1. Validaciones básicas
  if (!nombre || !permisos_json) {
    const error = new Error(
      "Nombre y permisos_json son obligatorios"
    );
    error.statusCode = 400;
    throw error;
  }

  // 2. Validar si ya existe en ese negocio
  const rolExistente = await rolRepository.findByNameAndNegocio(
    nombre,
    id_negocio
  );

  if (rolExistente) {
    const error = new Error(
      "Ya existe un rol con ese nombre en este negocio"
    );
    error.statusCode = 409;
    throw error;
  }

  // 3. Crear rol personalizado
  const nuevoRol = await rolRepository.create({
    id_negocio,
    nombre,
    descripcion,
    permisos_json,
    es_sistema: false
  });

  return nuevoRol;
};

/**
 * Obtener roles disponibles para un negocio
 */
export const getRolesByNegocioService = async (id_negocio) => {
  // Validar que el negocio exista
  const negocio = await negocioRepository.findById(id_negocio);

  if (!negocio) {
    throw new Error("NEGOCIO_NOT_FOUND");
  }

  const roles = await rolRepository.findAllByNegocio(id_negocio);

  return roles;
};