// negocio.controller.js
import * as negocioService from "./negocio.service.js";

export const createNegocio = async (req, res) => {
  try {
    const user = req.user;

    // 🔐 Validación de tipo de usuario
    if (!["negocio", "admin"].includes(user.tipo_usuario)) {
      return res.status(403).json({
        message: "No tienes permisos para crear un negocio",
      });
    }

    if (!req.body.nombre || !req.body.tipo) {
        return res.status(400).json({
            message: "Nombre y tipo son obligatorios",
        });
    }

    const data = {
      ...req.body,
      id_usuario_propietario: user.id_usuario,
    };

    const negocioId = await negocioService.createNegocio(data);

    res.status(201).json({
      message: "Negocio creado exitosamente",
      id_negocio: negocioId,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};


export const getMisNegocios = async (req, res) => {
  try {
    const user = req.user;

    // 🔐 Solo negocio o admin
    if (!["negocio", "admin"].includes(user.tipo_usuario)) {
      return res.status(403).json({
        message: "No tienes permisos para ver negocios",
      });
    }

    const negocios = await negocioService.getNegociosByUsuario(
      user.id_usuario
    );

    return res.status(200).json({
      ok: true,
      data: negocios,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getNegocioPublico = async (req, res) => {
  try {
    const { id } = req.params;

    const negocio = await negocioService.getNegocioPublico(id);

    if (!negocio) {
      return res.status(404).json({
        message: "Negocio no encontrado",
      });
    }

    return res.status(200).json({
      ok: true,
      data: negocio,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const updateNegocio = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const updated = await negocioService.updateNegocio(id, user.id_usuario, req.body);

    return res.status(200).json({
      ok: true,
      message: "Negocio actualizado correctamente",
      data: updated,
    });

  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message,
    });
  }
};

