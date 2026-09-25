import * as sucursalService from "./sucursal.service.js";

export const createSucursal = async (req, res) => {
  try {
    const user = req.user;
    const { id_negocio } = req.params;

    // Validación básica
    if (!id_negocio) {
      return res.status(400).json({
        ok: false,
        message: "El id del negocio es obligatorio",
      });
    }

    const sucursal = await sucursalService.createSucursal(
      user.id_usuario,
      parseInt(id_negocio),
      req.body
    );

    return res.status(201).json({
      ok: true,
      message: "Sucursal creada correctamente",
      data: sucursal,
    });

  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message,
    });
  }
};


export const getSucursalesPublico = async (req, res) => {
  try {
    const { id_negocio } = req.params;

    if (!id_negocio) {
      return res.status(400).json({
        ok: false,
        message: "El id del negocio es obligatorio",
      });
    }

    const sucursales = await sucursalService.getSucursalesPublico(
      parseInt(id_negocio)
    );

    return res.status(200).json({
      ok: true,
      data: sucursales,
    });

  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message,
    });
  }
};

// sucursal.controller.js

export const updateSucursal = async (req, res) => {
  try {
    const user = req.user;
    const { id_sucursal } = req.params;

    const result = await sucursalService.updateSucursal(
      user.id_usuario,
      id_sucursal,
      req.body
    );

    return res.status(200).json({
      ok: true,
      message: "Sucursal actualizada correctamente",
      data: result,
    });

  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message,
    });
  }
};
