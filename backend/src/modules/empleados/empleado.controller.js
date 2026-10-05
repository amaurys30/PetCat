import * as service from "./empleado.service.js";
import { ok, created, paginated } from "../../shared/utils/response.js";
import { mensajeConAfectadas } from "../disponibilidad/disponibilidad.service.js";
import { archivoUnico } from "../../shared/utils/uploads.js";

export const getEmpleados = async (req, res) => {
  const { rows, meta } = await service.getEmpleados(req.negocio.id_negocio, req.query);
  return paginated(res, rows, meta);
};

export const getProfesionales = async (req, res) => {
  return ok(res, await service.getProfesionales(req.negocio.id_negocio));
};

export const getEmpleado = async (req, res) => {
  return ok(res, await service.getEmpleado(req.params.id_empleado));
};

export const createEmpleado = async (req, res) => {
  const empleado = await service.createEmpleado(req.negocio.id_negocio, req.body, req.acceso);
  return created(res, empleado, "Empleado creado");
};

export const registrarPropietario = async (req, res) => {
  const { empleado, creado } = await service.registrarPropietario(req.negocio, req.user.id_usuario, req.body);
  return creado
    ? created(res, empleado, "Te registraste como empleado del negocio")
    : ok(res, empleado, "Tu cuenta quedó vinculada al empleado que ya existía con tu email");
};

export const updateEmpleado = async (req, res) => {
  const empleado = await service.updateEmpleado(req.params.id_empleado, req.body, req.acceso);
  return ok(res, empleado, "Empleado actualizado");
};

export const desactivarEmpleado = async (req, res) => {
  const data = await service.desactivarEmpleado(req.params.id_empleado, req.acceso);
  return ok(res, data, mensajeConAfectadas("Empleado desactivado", data.citas_afectadas));
};

export const reactivarEmpleado = async (req, res) => {
  const empleado = await service.reactivarEmpleado(req.params.id_empleado, req.acceso);
  return ok(res, empleado, "Empleado reactivado");
};

export const subirFoto = async (req, res) => {
  const archivo = archivoUnico(req, "empleado_foto");
  const empleado = await service.subirFoto(req.params.id_empleado, req.acceso, req.user.id_usuario, archivo);
  return ok(res, empleado, "Foto del empleado actualizada");
};

export const eliminarFoto = async (req, res) => {
  const empleado = await service.eliminarFoto(req.params.id_empleado, req.acceso, req.user.id_usuario);
  return ok(res, empleado, "Foto del empleado eliminada");
};
