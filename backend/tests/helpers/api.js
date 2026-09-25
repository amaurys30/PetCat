import request from "supertest";
import app from "../../src/app.js";

/**
 * Cliente supertest con prefijo /api/v1 y, si se pasa, el token en Authorization.
 *
 *   const res = await api(token).patch("/sucursales/3").send({ nombre: "Norte" });
 *   const res = await api().get("/negocios/1");            // sin autenticación
 */
export const api = (token) => {
  const agent = request(app);
  const withAuth = (req) => (token ? req.set("Authorization", `Bearer ${token}`) : req);
  const call = (method) => (path) => withAuth(agent[method](`/api/v1${path}`));

  return {
    get: call("get"),
    post: call("post"),
    put: call("put"),
    patch: call("patch"),
    delete: call("delete"),
  };
};
