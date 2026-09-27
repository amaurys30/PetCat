import { beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { authMiddleware } from "../../src/shared/middlewares/auth.middleware.js";
import { authorizeAny } from "../../src/shared/middlewares/authorize.middleware.js";
import { errorHandler } from "../../src/shared/middlewares/errorHandler.js";
import { ok } from "../../src/shared/utils/response.js";
import { crearEmpleado, crearNegocio, crearRol, crearUsuario, tokenDe } from "../helpers/factories.js";

// App mínima: sin validate, el parámetro llega como texto.
const app = express();
app.get(
  "/empleados/:id_empleado/recurso",
  authMiddleware,
  authorizeAny([["configuracion", "ver"], ["citas", "ver"]], {
    permitirSi: (req, acceso) => acceso.id_empleado === Number(req.params.id_empleado),
  }),
  (req, res) => ok(res, { acceso: req.acceso })
);
app.use(errorHandler);

const get = (path, token) => request(app).get(path).set("Authorization", `Bearer ${token}`);

describe("authorizeAny", () => {
  let negocio;

  beforeAll(async () => {
    negocio = await crearNegocio();
  });

  const empleadoConToken = async (permisos) => {
    const usuario = await crearUsuario();
    const rol = await crearRol(negocio, permisos);
    const empleado = await crearEmpleado(negocio, { usuario, rol: rol.id_rol });
    return { empleado, token: await tokenDe(usuario) };
  };

  it("pasa con cualquiera de los permisos", async () => {
    const otro = await crearEmpleado(negocio);
    for (const permisos of [{ configuracion: ["ver"] }, { citas: ["ver"] }]) {
      const { token } = await empleadoConToken(permisos);
      const res = await get(`/empleados/${otro.id_empleado}/recurso`, token);
      expect(res.status).toBe(200);
      expect(res.body.data.acceso.relacion).toBe("empleado");
    }
  });

  it("sin ninguno de los permisos -> 403, salvo que permitirSi lo deje pasar", async () => {
    const otro = await crearEmpleado(negocio);
    const { empleado, token } = await empleadoConToken({ inventario: ["ver"] });

    const ajeno = await get(`/empleados/${otro.id_empleado}/recurso`, token);
    expect(ajeno.status).toBe(403);
    expect(ajeno.body.message).toBe("No tienes permiso para realizar esta acción");

    const propio = await get(`/empleados/${empleado.id_empleado}/recurso`, token);
    expect(propio.status).toBe(200);
    expect(propio.body.data.acceso.id_empleado).toBe(empleado.id_empleado);
  });

  it("el propietario pasa siempre; alguien ajeno al negocio -> 403", async () => {
    const empleado = await crearEmpleado(negocio);
    expect((await get(`/empleados/${empleado.id_empleado}/recurso`, await tokenDe(negocio.propietario))).status).toBe(200);
    expect((await get(`/empleados/${empleado.id_empleado}/recurso`, await tokenDe(await crearUsuario()))).status).toBe(403);
  });

  it("falla al cargar las rutas con un permiso fuera del catálogo o sin permisos", () => {
    expect(() => authorizeAny([["citas", "volar"]])).toThrow('authorizeAny: permiso "citas.volar" fuera de CATALOGO_PERMISOS');
    expect(() => authorizeAny([])).toThrow("authorizeAny: indica al menos un permiso");
  });
});
