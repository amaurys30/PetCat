import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { api } from "../helpers/api.js";
import {
  crearCita,
  crearEmpleado,
  crearNegocio,
  crearRol,
  crearSucursal,
  crearUsuario,
  tokenDe,
} from "../helpers/factories.js";

const principalDe = async (id_negocio) => {
  const [rows] = await pool.query(
    "SELECT id_sucursal FROM sucursales WHERE id_negocio = ? AND es_principal = TRUE",
    [id_negocio]
  );
  return rows.map((r) => r.id_sucursal);
};

const negocioConToken = async (plan = "Gratuito") => {
  const negocio = await crearNegocio(null, { plan });
  return { negocio, token: await tokenDe(negocio.propietario) };
};

describe("GET /negocios/:id_negocio/sucursales y /sucursales/:id_sucursal (públicos)", () => {
  it("lista solo las activas, la principal primero, sin token", async () => {
    const negocio = await crearNegocio();
    const otra = await crearSucursal(negocio, { nombre: "Otra" });
    const principal = await crearSucursal(negocio, { nombre: "Principal", es_principal: true, latitud: 9.3, longitud: -75.4 });
    await crearSucursal(negocio, { nombre: "Cerrada", activo: false });

    const res = await api().get(`/negocios/${negocio.id_negocio}/sucursales`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((s) => s.id_sucursal)).toEqual([principal.id_sucursal, otra.id_sucursal]);
    expect(res.body.data[0]).toMatchObject({ es_principal: true, latitud: 9.3, longitud: -75.4 });

    const detalle = await api().get(`/sucursales/${otra.id_sucursal}`);
    expect(detalle.status).toBe(200);
    expect(detalle.body.data).toMatchObject({ nombre: "Otra", es_principal: false });
  });

  it("404 con negocio inactivo, sucursal inactiva o inexistente; 422 con id inválido", async () => {
    const inactivo = await crearNegocio(null, { activo: false });
    const deInactivo = await crearSucursal(inactivo);
    expect((await api().get(`/negocios/${inactivo.id_negocio}/sucursales`)).status).toBe(404);
    expect((await api().get(`/sucursales/${deInactivo.id_sucursal}`)).status).toBe(404);

    const cerrada = await crearSucursal(await crearNegocio(), { activo: false });
    expect((await api().get(`/sucursales/${cerrada.id_sucursal}`)).status).toBe(404);
    expect((await api().get("/sucursales/999999")).status).toBe(404);
    expect((await api().get("/sucursales/0")).status).toBe(422);
  });
});

describe("POST /negocios/:id_negocio/sucursales", () => {
  it("la primera sucursal queda como principal aunque no se pida", async () => {
    const { negocio, token } = await negocioConToken();
    const res = await api(token)
      .post(`/negocios/${negocio.id_negocio}/sucursales`)
      .send({ nombre: "Sede Norte", direccion: "Cra 25 # 30-10", es_principal: false });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ nombre: "Sede Norte", ciudad: "Sincelejo", es_principal: true });
  });

  it("crear otra como principal desmarca la anterior", async () => {
    // Varias sucursales: el Gratuito solo permite una.
    const { negocio, token } = await negocioConToken("Pro");
    const primera = await crearSucursal(negocio, { es_principal: true });

    const segunda = await api(token)
      .post(`/negocios/${negocio.id_negocio}/sucursales`)
      .send({ nombre: "Segunda", direccion: "Calle 1" });
    expect(segunda.body.data.es_principal).toBe(false);
    expect(await principalDe(negocio.id_negocio)).toEqual([primera.id_sucursal]);

    const tercera = await api(token)
      .post(`/negocios/${negocio.id_negocio}/sucursales`)
      .send({ nombre: "Tercera", direccion: "Calle 2", es_principal: true });
    expect(await principalDe(negocio.id_negocio)).toEqual([tercera.body.data.id_sucursal]);
  });

  it("empleado con configuracion.editar crea; sin él -> 403; sin token -> 401", async () => {
    const negocio = await crearNegocio();
    const editor = await crearUsuario();
    const lector = await crearUsuario();
    await crearEmpleado(negocio, { usuario: editor, rol: (await crearRol(negocio, { configuracion: ["editar"] })).id_rol });
    await crearEmpleado(negocio, { usuario: lector, rol: (await crearRol(negocio, { configuracion: ["ver"] })).id_rol });
    const body = { nombre: "Sede", direccion: "Calle 3" };

    expect((await api(await tokenDe(editor)).post(`/negocios/${negocio.id_negocio}/sucursales`).send(body)).status).toBe(201);
    expect((await api(await tokenDe(lector)).post(`/negocios/${negocio.id_negocio}/sucursales`).send(body)).status).toBe(403);
    expect((await api().post(`/negocios/${negocio.id_negocio}/sucursales`).send(body)).status).toBe(401);
  });

  it("negocio inexistente -> 404; datos inválidos -> 422", async () => {
    const { negocio, token } = await negocioConToken();
    expect((await api(token).post("/negocios/999999/sucursales").send({ nombre: "Sede", direccion: "X" })).status).toBe(404);

    const res = await api(token)
      .post(`/negocios/${negocio.id_negocio}/sucursales`)
      .send({ nombre: "S", id_negocio: 1, activo: false });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.errors).sort()).toEqual(["activo", "direccion", "id_negocio", "nombre"]);
  });
});

describe("PATCH /sucursales/:id_sucursal", () => {
  it("actualiza campos y marcar como principal desmarca la anterior", async () => {
    const { negocio, token } = await negocioConToken();
    const principal = await crearSucursal(negocio, { es_principal: true });
    const otra = await crearSucursal(negocio);

    const res = await api(token)
      .patch(`/sucursales/${otra.id_sucursal}`)
      .send({ nombre: "Renombrada", telefono: null, es_principal: true });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ nombre: "Renombrada", telefono: null, es_principal: true });
    expect(await principalDe(negocio.id_negocio)).toEqual([otra.id_sucursal]);

    // La anterior principal se puede editar sin tocar es_principal.
    expect((await api(token).patch(`/sucursales/${principal.id_sucursal}`).send({ ciudad: "Corozal" })).status).toBe(200);
  });

  it("desmarcar la sucursal principal -> 409", async () => {
    const { negocio, token } = await negocioConToken();
    const principal = await crearSucursal(negocio, { es_principal: true });
    await crearSucursal(negocio);

    const res = await api(token).patch(`/sucursales/${principal.id_sucursal}`).send({ es_principal: false });
    expect(res.status).toBe(409);
    expect(await principalDe(negocio.id_negocio)).toEqual([principal.id_sucursal]);
  });

  it("no permite mover la sucursal a otro negocio ni campos desconocidos -> 422", async () => {
    const { negocio, token } = await negocioConToken();
    const sucursal = await crearSucursal(negocio);
    const res = await api(token).patch(`/sucursales/${sucursal.id_sucursal}`).send({ id_negocio: 1 });
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({ id_negocio: "Campo no permitido" });

    expect((await api(token).patch(`/sucursales/${sucursal.id_sucursal}`).send({})).status).toBe(422);
    expect((await api(token).patch(`/sucursales/${sucursal.id_sucursal}`).send({ latitud: 9 })).status).toBe(422);
  });

  it("401 sin token, 403 de otro negocio, 404 inexistente o eliminada", async () => {
    const { negocio, token } = await negocioConToken();
    const sucursal = await crearSucursal(negocio);
    const eliminada = await crearSucursal(negocio, { activo: false });

    expect((await api().patch(`/sucursales/${sucursal.id_sucursal}`).send({ nombre: "Nueva" })).status).toBe(401);
    const ajeno = await tokenDe((await crearNegocio()).propietario);
    expect((await api(ajeno).patch(`/sucursales/${sucursal.id_sucursal}`).send({ nombre: "Nueva" })).status).toBe(403);
    expect((await api(token).patch("/sucursales/999999").send({ nombre: "Nueva" })).status).toBe(404);
    expect((await api(token).patch(`/sucursales/${eliminada.id_sucursal}`).send({ nombre: "Nueva" })).status).toBe(404);
  });
});

describe("DELETE /sucursales/:id_sucursal", () => {
  it("borrado lógico de una sucursal que no es la principal", async () => {
    const { negocio, token } = await negocioConToken();
    await crearSucursal(negocio, { es_principal: true });
    const otra = await crearSucursal(negocio);

    const res = await api(token).delete(`/sucursales/${otra.id_sucursal}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Sucursal eliminada");

    const [[fila]] = await pool.query("SELECT activo FROM sucursales WHERE id_sucursal = ?", [otra.id_sucursal]);
    expect(fila.activo).toBe(0);
    expect((await api(token).delete(`/sucursales/${otra.id_sucursal}`)).status).toBe(404);
  });

  it("la principal con otras sucursales activas -> 409; si es la única, se elimina", async () => {
    const { negocio, token } = await negocioConToken();
    const principal = await crearSucursal(negocio, { es_principal: true });
    const otra = await crearSucursal(negocio);

    expect((await api(token).delete(`/sucursales/${principal.id_sucursal}`)).status).toBe(409);

    await api(token).delete(`/sucursales/${otra.id_sucursal}`);
    expect((await api(token).delete(`/sucursales/${principal.id_sucursal}`)).status).toBe(200);
    expect(await principalDe(negocio.id_negocio)).toEqual([]);
  });

  it("con citas futuras pendientes o confirmadas -> 409; pasadas o canceladas no bloquean", async () => {
    const { negocio, token } = await negocioConToken();
    await crearSucursal(negocio, { es_principal: true });
    const conPendiente = await crearSucursal(negocio);
    const conConfirmada = await crearSucursal(negocio);
    const sinActivas = await crearSucursal(negocio);

    await crearCita(negocio, { id_sucursal: conPendiente.id_sucursal, estado: "pendiente" });
    await crearCita(negocio, { id_sucursal: conConfirmada.id_sucursal, estado: "confirmada" });
    await crearCita(negocio, { id_sucursal: sinActivas.id_sucursal, estado: "cancelada" });
    await crearCita(negocio, { id_sucursal: sinActivas.id_sucursal, estado: "pendiente", fecha: "2020-01-01" });

    const pendiente = await api(token).delete(`/sucursales/${conPendiente.id_sucursal}`);
    expect(pendiente.status).toBe(409);
    expect(pendiente.body.message).toMatch(/1 cita futura/);
    expect((await api(token).delete(`/sucursales/${conConfirmada.id_sucursal}`)).status).toBe(409);
    expect((await api(token).delete(`/sucursales/${sinActivas.id_sucursal}`)).status).toBe(200);
  });

  it("401 sin token y 403 sin configuracion.editar", async () => {
    const { negocio } = await negocioConToken();
    const sucursal = await crearSucursal(negocio);
    const lector = await crearUsuario();
    await crearEmpleado(negocio, { usuario: lector, rol: (await crearRol(negocio, { configuracion: ["ver"] })).id_rol });

    expect((await api().delete(`/sucursales/${sucursal.id_sucursal}`)).status).toBe(401);
    expect((await api(await tokenDe(lector)).delete(`/sucursales/${sucursal.id_sucursal}`)).status).toBe(403);
  });
});
