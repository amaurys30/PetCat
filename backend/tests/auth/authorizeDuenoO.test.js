import { beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { pool } from "../../src/config/db.js";
import { authMiddleware } from "../../src/shared/middlewares/auth.middleware.js";
import { authorizeDuenoO } from "../../src/shared/middlewares/authorize.middleware.js";
import { errorHandler } from "../../src/shared/middlewares/errorHandler.js";
import { ok } from "../../src/shared/utils/response.js";
import {
  crearAdmin,
  crearCita,
  crearEmpleado,
  crearMascota,
  crearNegocio,
  crearRol,
  crearUsuario,
  tokenDe,
} from "../helpers/factories.js";

const esDueno = async (req) => {
  const [[cita]] = await pool.query("SELECT id_usuario FROM citas WHERE id_cita = ?", [req.params.id_cita]);
  return cita?.id_usuario === req.user.id_usuario;
};

// App mínima: el middleware se prueba solo.
const app = express();
app.get("/citas/:id_cita", authMiddleware, authorizeDuenoO("citas", "ver", { esDueno }), (req, res) =>
  ok(res, { acceso: req.acceso, id_negocio: req.negocio?.id_negocio ?? null })
);
app.use(errorHandler);

const get = (path, token) => {
  const req = request(app).get(path);
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
};

describe("authorizeDuenoO", () => {
  let negocio;
  let dueno;
  let cita;

  beforeAll(async () => {
    negocio = await crearNegocio();
    dueno = await crearUsuario();
    cita = await crearCita(negocio, { cliente: dueno, mascota: await crearMascota(dueno) });
  });

  const empleadoConPermisos = async (permisos, usuario = null) => {
    const cuenta = usuario ?? (await crearUsuario());
    await crearEmpleado(negocio, { usuario: cuenta, rol: (await crearRol(negocio, permisos)).id_rol });
    return tokenDe(cuenta);
  };

  it("el dueño pasa con relacion dueno y sin negocio", async () => {
    const res = await get(`/citas/${cita.id_cita}`, await tokenDe(dueno));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ acceso: { relacion: "dueno" }, id_negocio: null });
  });

  it("propietario, admin y empleado con citas.ver reciben el acceso del panel", async () => {
    for (const token of [
      await tokenDe(negocio.propietario),
      await tokenDe(await crearAdmin()),
      await empleadoConPermisos({ citas: ["ver"] }),
    ]) {
      const res = await get(`/citas/${cita.id_cita}`, token);
      expect(res.status).toBe(200);
      expect(res.body.data.id_negocio).toBe(negocio.id_negocio);
      expect(res.body.data.acceso.relacion).not.toBe("dueno");
    }
  });

  it("personal del negocio que además es el dueño recibe la vista del panel", async () => {
    const usuario = await crearUsuario();
    const propia = await crearCita(negocio, { cliente: usuario, mascota: await crearMascota(usuario) });
    const token = await empleadoConPermisos({ citas: ["ver"] }, usuario);
    const res = await get(`/citas/${propia.id_cita}`, token);
    expect(res.body.data.acceso.relacion).toBe("empleado");
  });

  it("empleado sin citas.ver que no es el dueño, personal de otro negocio o un tercero -> 403", async () => {
    const otroNegocio = await crearNegocio();
    for (const token of [
      await empleadoConPermisos({ inventario: ["ver"] }),
      await tokenDe(otroNegocio.propietario),
      await tokenDe(await crearUsuario()),
    ]) {
      const res = await get(`/citas/${cita.id_cita}`, token);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe("No tienes acceso a este recurso");
    }
  });

  it("cita inexistente -> 404; sin token -> 401", async () => {
    expect((await get("/citas/999999999", await tokenDe(dueno))).status).toBe(404);
    expect((await get(`/citas/${cita.id_cita}`)).status).toBe(401);
  });

  it("falla al cargar las rutas con un permiso fuera del catálogo", () => {
    expect(() => authorizeDuenoO("citas", "volar", { esDueno })).toThrow("fuera de CATALOGO_PERMISOS");
  });
});
