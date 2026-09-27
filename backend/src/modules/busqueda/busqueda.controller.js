import * as service from "./busqueda.service.js";
import { paginated } from "../../shared/utils/response.js";

export const buscarNegocios = async (req, res) => {
  const { rows, meta } = await service.buscarNegocios(req.query);
  return paginated(res, rows, meta);
};

export const buscarServicios = async (req, res) => {
  const { rows, meta } = await service.buscarServicios(req.query);
  return paginated(res, rows, meta);
};
