import * as service from "./autorizacion.service.js";
import { ok } from "../../shared/utils/response.js";

export const getPoliticaVigente = async (req, res) => {
  return ok(res, await service.getPoliticaVigente());
};
