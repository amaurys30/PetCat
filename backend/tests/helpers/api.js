import request from "supertest";
import app from "../../src/app.js";
import { verificarContrato } from "./contrato.js";

/**
 * Cliente supertest con prefijo /api/v1 y, si se pasa, el token en Authorization.
 * Cada respuesta 2xx se compara con su esquema de Swagger (helpers/contrato.js).
 *
 *   const res = await api(token).patch("/sucursales/3").send({ nombre: "Norte" });
 *   const res = await api().get("/negocios/1");            // sin autenticación
 */
export const api = (token) => {
  const agent = request(app);
  const withAuth = (req) => (token ? req.set("Authorization", `Bearer ${token}`) : req);
  const call = (method) => (path) =>
    withAuth(agent[method](`/api/v1${path}`)).expect((res) => verificarContrato(method, path, res));

  return {
    get: call("get"),
    post: call("post"),
    put: call("put"),
    patch: call("patch"),
    delete: call("delete"),
  };
};
