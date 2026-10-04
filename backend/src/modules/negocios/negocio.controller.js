import * as service from "./negocio.service.js";
import { ok, created } from "../../shared/utils/response.js";
import { archivoUnico } from "../../shared/utils/uploads.js";

export const createNegocio = async (req, res) => {
  const negocio = await service.createNegocio(req.user.id_usuario, req.body);
  return created(res, negocio, "Negocio creado");
};

export const getMisNegocios = async (req, res) => {
  return ok(res, await service.getMisNegocios(req.user.id_usuario));
};

export const getPerfilPublico = async (req, res) => {
  return ok(res, await service.getPerfilPublico(req.params.id_negocio));
};

export const getGestion = async (req, res) => {
  return ok(res, await service.getGestion(req.negocio));
};

const MENSAJES_IMAGEN = {
  logo: { subida: "Logo actualizado", eliminada: "Logo eliminado" },
  banner: { subida: "Banner actualizado", eliminada: "Banner eliminado" },
};

/** `tipo`: "logo" o "banner". */
export const subirImagen = (tipo) => async (req, res) => {
  const archivo = archivoUnico(req, `negocio_${tipo}`);
  const negocio = await service.subirImagen(req.negocio.id_negocio, tipo, req.user.id_usuario, archivo);
  return ok(res, negocio, MENSAJES_IMAGEN[tipo].subida);
};

export const eliminarImagen = (tipo) => async (req, res) => {
  const negocio = await service.eliminarImagen(req.negocio.id_negocio, tipo, req.user.id_usuario);
  return ok(res, negocio, MENSAJES_IMAGEN[tipo].eliminada);
};

export const updateNegocio = async (req, res) => {
  const negocio = await service.updateNegocio(req.negocio.id_negocio, req.body);
  return ok(res, negocio, "Negocio actualizado");
};
