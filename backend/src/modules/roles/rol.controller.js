// ================================
// modules/roles/rol.controller.js
// ================================
import {
  getRolesByNegocioService
} from "./rol.service.js";


import * as rolService from "./rol.service.js";

export const createRol = async (req, res) => {
  try {
    const { id_negocio } = req.params;

    const {
      nombre,
      descripcion,
      permisos_json
    } = req.body;

    const nuevoRol = await rolService.createRol({
      id_negocio,
      nombre,
      descripcion,
      permisos_json
    });

    return res.status(201).json({
      ok: true,
      message: "Rol creado correctamente",
      data: nuevoRol
    });

  } catch (error) {
    console.error("ERROR CREATE ROL:", error);

    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "Error al crear rol"
    });
  }
};

/**
 * GET - Obtener roles de un negocio
 */
export const getRolesByNegocio = async (req, res) => {
  try {
    const { id_negocio } = req.params;

    const roles = await getRolesByNegocioService(
      Number(id_negocio)
    );

    return res.status(200).json({
      ok: true,
      message: "Roles obtenidos correctamente",
      total: roles.length,
      data: roles
    });

  } catch (error) {
    console.error("ERROR GET ROLES:", error);

    if (error.message === "NEGOCIO_NOT_FOUND") {
      return res.status(404).json({
        ok: false,
        message: "Negocio no encontrado"
      });
    }

    return res.status(500).json({
      ok: false,
      message: "Error interno del servidor"
    });
  }
};
