import * as service from "./publico.service.js";
import { ok } from "../../shared/utils/response.js";

// Lo mismo que guarda el servidor: el navegador y un CDN pueden reutilizarlo ese tiempo.
const cachePublica = (res) => res.set("Cache-Control", `public, max-age=${service.CACHE_SEGUNDOS}`);

export const getEstadisticas = async (req, res) => {
  cachePublica(res);
  return ok(res, await service.getEstadisticas());
};

export const getResenas = async (req, res) => {
  cachePublica(res);
  return ok(res, await service.getResenas(req.query.limit));
};

export const getConfiguracion = async (req, res) => {
  cachePublica(res);
  return ok(res, await service.getConfiguracion());
};
