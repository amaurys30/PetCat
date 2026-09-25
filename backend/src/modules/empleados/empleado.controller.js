import * as empleadoService from "./empleado.service.js";
import * as userRepo from "../usuarios/usuario.repository.js";
import * as empleadoRepo from "./empleado.repository.js";

export const createEmpleado = async (req, res) => {
  try {
    const user = req.user;
    const { id_negocio } = req.params;

    const empleado = await empleadoService.createEmpleado(
      user.id_usuario,
      id_negocio,
      req.body
    );

    return res.status(201).json({
      ok: true,
      message: "Empleado creado correctamente",
      data: empleado,
    });

  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message,
    });
  }
};

export const getEmpleadosByNegocio = async (req, res) => {
  try {
    const { id_negocio } = req.params;

    const empleados = await empleadoService.getEmpleadosByNegocio(
      id_negocio
    );

    return res.status(200).json({
      ok: true,
      data: empleados,
    });

  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message,
    });
  }
};


export const updateEmpleado = async (req, res) => {
  try {
    const { id_empleado } = req.params;

    const empleado = await empleadoService.updateEmpleado(
      req.user,
      id_empleado,
      req.body
    );

    return res.status(200).json({
      ok: true,
      message: "Empleado actualizado correctamente",
      data: empleado,
    });

  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message || "Error interno del servidor",
    });
  }
};



export const getEmpleadoById = async (req, res) => {
  try {
    // authorize ya comprobó que existe y que es del negocio del usuario.
    const empleado = await empleadoRepo.findById(req.params.id_empleado);

    return res.status(200).json({
      ok: true,
      data: empleado,
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error obteniendo el empleado",
    });
  }
};

export const deleteEmpleado = async (req, res) => {
  try {
    const user = req.user;
    const { id_empleado } = req.params;

    const result = await empleadoService.deleteEmpleado(
      user.id_usuario,
      id_empleado
    );

    return res.status(200).json({
      ok: true,
      message: "Empleado desactivado correctamente",
      data: result,
    });

  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message,
    });
  }
};

export const reactivarEmpleado = async (req, res) => {
  try {
    const { id_empleado } = req.params;

    const result = await empleadoService.reactivarEmpleado(
      id_empleado
    );

    return res.status(200).json({
      ok: true,
      message: "Empleado reactivado correctamente",
      data: result,
    });

  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message,
    });
  }
};