import * as service from "./resena.service.js";
import { ok, created, paginated } from "../../shared/utils/response.js";

const usuarioDe = (req) => ({ id_usuario: req.user.id_usuario });

export const crearResena = async (req, res) => {
  return created(res, await service.crearResena(req.params.id_cita, req.body, usuarioDe(req)), "Reseña publicada");
};

export const editarResena = async (req, res) => {
  return ok(res, await service.editarResena(req.params.id_resena, req.body, usuarioDe(req)), "Reseña actualizada");
};

export const retirarResena = async (req, res) => {
  await service.retirarResena(req.params.id_resena, usuarioDe(req));
  return ok(res, null, "Reseña retirada");
};

export const getMisResenas = async (req, res) => {
  const { rows, meta } = await service.getMisResenas(req.user.id_usuario, req.query);
  return paginated(res, rows, meta);
};

export const getResenasPublicas = async (req, res) => {
  const { rows, meta } = await service.getResenasPublicas(req.params.id_negocio, req.query);
  return paginated(res, rows, meta);
};

export const getResenasGestion = async (req, res) => {
  const { rows, meta } = await service.getResenasGestion(req.negocio.id_negocio, req.query);
  return paginated(res, rows, meta);
};

export const responderResena = async (req, res) => {
  return ok(res, await service.responderResena(req.params.id_resena, req.body, usuarioDe(req)), "Respuesta publicada");
};

export const borrarRespuesta = async (req, res) => {
  return ok(res, await service.borrarRespuesta(req.params.id_resena), "Respuesta eliminada");
};

export const reportarResena = async (req, res) => {
  return ok(
    res,
    await service.reportarResena(req.params.id_resena, req.body, usuarioDe(req)),
    "Reseña reportada: PetCat la revisará"
  );
};
