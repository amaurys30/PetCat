import * as service from "./historial.service.js";
import { ok, created, paginated } from "../../shared/utils/response.js";
import { archivosDe } from "../../shared/utils/uploads.js";

export const getHistorialDueno = async (req, res) => {
  const { rows, meta } = await service.getHistorialDueno(req.user.id_usuario, req.params.id_mascota, req.query);
  return paginated(res, rows, meta);
};

export const getHistorialNegocio = async (req, res) => {
  const { rows, meta } = await service.getHistorialNegocio(req.negocio.id_negocio, req.params.id_mascota, req.query);
  return paginated(res, rows, meta);
};

export const crearRegistro = async (req, res) => {
  const registro = await service.crearRegistro(req.negocio, { id_usuario: req.user.id_usuario, acceso: req.acceso }, req.body);
  return created(res, registro, "Registro de historial creado");
};

export const actualizarRegistro = async (req, res) => {
  const registro = await service.actualizarRegistro(req.params.id_historial, req.negocio, req.user.id_usuario, req.body);
  return ok(res, registro, "Registro actualizado");
};

export const agregarArchivos = async (req, res) => {
  const archivos = archivosDe(req, "historial_archivo");
  const registro = await service.agregarArchivos(req.params.id_historial, req.negocio, req.user.id_usuario, archivos);
  return created(res, registro, "Archivos agregados");
};

export const eliminarArchivo = async (req, res) => {
  const { id_historial, id_archivo } = req.params;
  const registro = await service.eliminarArchivo(id_historial, id_archivo, req.negocio, req.user.id_usuario);
  return ok(res, registro, "Archivo eliminado");
};
