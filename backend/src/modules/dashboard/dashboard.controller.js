import * as service from "./dashboard.service.js";
import { ok } from "../../shared/utils/response.js";

export const getDashboard = async (req, res) => {
  return ok(res, await service.getDashboard(req.negocio, req.query));
};
