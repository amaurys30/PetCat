import { beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { authMiddleware } from "../../src/shared/middlewares/auth.middleware.js";
import { authorize } from "../../src/shared/middlewares/authorize.middleware.js";
import { errorHandler } from "../../src/shared/middlewares/errorHandler.js";
import { ok } from "../../src/shared/utils/response.js";
import * as negocioRepo from "../../src/modules/negocios/negocio.repository.js";
import {
  crearAdmin,
  crearEmpleado,
  crearNegocio,
  crearRol,
  crearSucursal,
  crearUsuario,
  rolDelSistema,
  tokenDe,
} from "../helpers/factories.js";

// App mínima: authorize se prueba solo, sin depender de las rutas de los módulos.
const app = express();
const responder = (req, res) =>
  ok(res, { acceso: req.acceso, id_negocio: req.negocio?.id_negocio ?? null });
const guard = [authMiddleware, authorize("citas", "ver")];
app.get("/negocios/:id_negocio/recurso", guard, responder);
app.get("/sucursales/:id_sucursal", guard, responder);
app.get("/empleados/:id_empleado", guard, responder);
app.get("/roles/:id_rol", guard, responder);
app.get("/sin-negocio", guard, responder);
app.use(errorHandler);

const get = (path, token) => {
  const req = request(app).get(path);
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
};

describe("authorize", () => {
  let negocio;
  let tokenPropietario;

  beforeAll(async () => {
    negocio = await crearNegocio();
    tokenPropietario = await tokenDe(negocio.propietario);
  });

  const empleadoConToken = async (permisos, overrides = {}) => {
    const usuario = await crearUsuario();
    const rol = await crearRol(negocio, permisos);
    const empleado = await crearEmpleado(negocio, { usuario, rol: rol.id_rol, ...overrides });
    return { empleado, token: await tokenDe(usuario) };
  };

  it("sin token -> 401", async () => {
    const res = await get(`/negocios/${negocio.id_negocio}/recurso`);
    expect(res.status).toBe(401);
  });

  it("el propietario pasa y queda req.negocio", async () => {
    const res = await get(`/negocios/${negocio.id_negocio}/recurso`, tokenPropietario);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ acceso: { relacion: "propietario" }, id_negocio: negocio.id_negocio });
  });

  it("el admin de plataforma pasa en cualquier negocio", async () => {
    const res = await get(`/negocios/${negocio.id_negocio}/recurso`, await tokenDe(await crearAdmin()));
    expect(res.status).toBe(200);
    expect(res.body.data.acceso).toEqual({ relacion: "admin" });
  });

  it("un usuario sin relación con el negocio -> 403", async () => {
    const res = await get(`/negocios/${negocio.id_negocio}/recurso`, await tokenDe(await crearUsuario()));
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("No perteneces a este negocio");
  });

  it("tipo_usuario 'negocio' no da acceso a un negocio ajeno", async () => {
    const otro = await crearNegocio();
    const res = await get(`/negocios/${negocio.id_negocio}/recurso`, await tokenDe(otro.propietario));
    expect(res.status).toBe(403);
  });

  it("empleado activo con el permiso pasa", async () => {
    const { empleado, token } = await empleadoConToken({ citas: ["ver", "crear"] });
    const res = await get(`/negocios/${negocio.id_negocio}/recurso`, token);
    expect(res.status).toBe(200);
    expect(res.body.data.acceso).toEqual({
      relacion: "empleado",
      id_empleado: empleado.id_empleado,
      id_rol: empleado.id_rol,
      permisos: { citas: ["ver", "crear"] },
    });
  });

  it("empleado sin el permiso -> 403", async () => {
    const { token } = await empleadoConToken({ citas: ["crear"], servicios: ["ver"] });
    const res = await get(`/negocios/${negocio.id_negocio}/recurso`, token);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("No tienes permiso para realizar esta acción");
  });

  it("empleado inactivo -> 403 aunque su rol tenga el permiso", async () => {
    const { token } = await empleadoConToken({ citas: ["ver"] }, { activo: false });
    const res = await get(`/negocios/${negocio.id_negocio}/recurso`, token);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Tu acceso a este negocio está desactivado");
  });

  it("los permisos son por negocio: un empleado de dos negocios", async () => {
    const usuario = await crearUsuario();
    const otro = await crearNegocio();
    await crearEmpleado(negocio, { usuario, rol: (await crearRol(negocio, { citas: ["ver"] })).id_rol });
    await crearEmpleado(otro, { usuario, rol: (await crearRol(otro, { servicios: ["ver"] })).id_rol });
    const token = await tokenDe(usuario);

    expect((await get(`/negocios/${negocio.id_negocio}/recurso`, token)).status).toBe(200);
    expect((await get(`/negocios/${otro.id_negocio}/recurso`, token)).status).toBe(403);
  });

  it("negocio inexistente -> 404", async () => {
    const res = await get("/negocios/999999/recurso", tokenPropietario);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Negocio no encontrado");
  });

  it("resuelve el negocio desde :id_sucursal y :id_empleado", async () => {
    const sucursal = await crearSucursal(negocio);
    const empleado = await crearEmpleado(negocio);
    const ajeno = await tokenDe(await crearUsuario());

    for (const path of [`/sucursales/${sucursal.id_sucursal}`, `/empleados/${empleado.id_empleado}`]) {
      const res = await get(path, tokenPropietario);
      expect(res.status, path).toBe(200);
      expect(res.body.data.id_negocio).toBe(negocio.id_negocio);
      expect((await get(path, ajeno)).status, path).toBe(403);
    }
  });

  it("recurso inexistente -> 404 con el nombre del recurso", async () => {
    expect((await get("/sucursales/999999", tokenPropietario)).body.message).toBe("Sucursal no encontrada");
    expect((await get("/empleados/999999", tokenPropietario)).body.message).toBe("Empleado no encontrado");
    expect((await get("/roles/999999", tokenPropietario)).status).toBe(404);
  });

  it("ignora un id_negocio en el query: manda el del recurso", async () => {
    const otro = await crearNegocio();
    const sucursalAjena = await crearSucursal(otro);
    const res = await get(`/sucursales/${sucursalAjena.id_sucursal}?id_negocio=${negocio.id_negocio}`, tokenPropietario);
    expect(res.status).toBe(403);
  });

  it("rol propio del negocio: lo resuelve; rol del sistema: solo el admin", async () => {
    const rol = await crearRol(negocio, {});
    expect((await get(`/roles/${rol.id_rol}`, tokenPropietario)).status).toBe(200);

    const idSistema = await rolDelSistema("Veterinario");
    expect((await get(`/roles/${idSistema}`, tokenPropietario)).status).toBe(403);

    const admin = await get(`/roles/${idSistema}`, await tokenDe(await crearAdmin()));
    expect(admin.status).toBe(200);
    expect(admin.body.data).toEqual({ acceso: { relacion: "admin" }, id_negocio: null });
  });

  it("una ruta sin parámetro de negocio es un error de programación -> 500", async () => {
    const res = await get("/sin-negocio", tokenPropietario);
    expect(res.status).toBe(500);
  });

  it("las consultas de todos los resolvers son válidas", async () => {
    for (const param of negocioRepo.RECURSOS_CON_NEGOCIO) {
      await expect(negocioRepo.findNegocioDeRecurso(param, 0), param).resolves.toBeUndefined();
    }
  });
});
