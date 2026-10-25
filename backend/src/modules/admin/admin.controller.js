import * as service from "./admin.service.js";
import { ok, paginated } from "../../shared/utils/response.js";

export const getNegocios = async (req, res) => {
  const { rows, meta } = await service.getNegocios(req.query);
  return paginated(res, rows, meta);
};

export const getHistorialSuscripciones = async (req, res) => {
  return ok(res, await service.getHistorialSuscripciones(req.params.id_negocio));
};
