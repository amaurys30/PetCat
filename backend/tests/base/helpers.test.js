import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { api } from "../helpers/api.js";
import {
  crearUsuario,
  crearAdmin,
  crearNegocio,
  crearSucursal,
  crearRol,
  crearEmpleado,
  rolDelSistema,
  tokenDe,
  PASSWORD,
} from "../helpers/factories.js";
import { comparePassword } from "../../src/shared/utils/hash.js";

describe("helpers de tests", () => {
  it("crearUsuario genera emails únicos y la contraseña común", async () => {
    const a = await crearUsuario();
    const b = await crearUsuario({ nombre: "Otro" });
    expect(a.email).not.toBe(b.email);
    expect(b.nombre).toBe("Otro");
    expect(await comparePassword(PASSWORD, a.password_hash)).toBe(true);
    expect((await crearAdmin()).tipo_usuario).toBe("admin");
  });

  it("crearNegocio crea propietario y suscripción Gratuita", async () => {
    const negocio = await crearNegocio();
    expect(negocio.id_usuario_propietario).toBe(negocio.propietario.id_usuario);

    const [[suscripcion]] = await pool.query(
      `SELECT p.nombre FROM suscripciones s JOIN planes_suscripcion p ON p.id_plan = s.id_plan
       WHERE s.id_negocio = ?`,
      [negocio.id_negocio]
    );
    expect(suscripcion.nombre).toBe("Gratuito");
  });

  it("crearSucursal, crearRol y crearEmpleado quedan ligados al negocio", async () => {
    const negocio = await crearNegocio();
    const sucursal = await crearSucursal(negocio, { es_principal: true });
    const rol = await crearRol(negocio, { citas: ["ver"] });
    const usuario = await crearUsuario();
    const vinculado = await crearEmpleado(negocio, { usuario, rol: rol.id_rol });
    const sinCuenta = await crearEmpleado(negocio, { rol: "Recepcionista", activo: false });

    expect(sucursal).toMatchObject({ id_negocio: negocio.id_negocio, es_principal: 1 });
    expect(rol).toMatchObject({ id_negocio: negocio.id_negocio, es_sistema: 0 });
    expect(vinculado).toMatchObject({ id_usuario: usuario.id_usuario, id_rol: rol.id_rol, email: usuario.email });
    expect(sinCuenta).toMatchObject({
      id_usuario: null,
      id_rol: await rolDelSistema("Recepcionista"),
      activo: 0,
    });
  });

  it("tokenDe da un token aceptado por las rutas protegidas; sin token responde 401", async () => {
    const negocio = await crearNegocio();
    const token = await tokenDe(negocio.propietario);

    const conToken = await api(token).get("/negocios/mios");
    expect(conToken.status).toBe(200);

    const sinToken = await api().get("/negocios/mios");
    expect(sinToken.status).toBe(401);
  });
});
