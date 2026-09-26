import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { api } from "../helpers/api.js";
import {
  crearAdmin,
  crearEmpleado,
  crearNegocio,
  crearRol,
  crearUsuario,
  rolDelSistema,
  tokenDe,
} from "../helpers/factories.js";

const negocioConToken = async () => {
  const negocio = await crearNegocio();
  return { negocio, token: await tokenDe(negocio.propietario) };
};

/** Empleado vinculado con un rol propio del negocio con esos permisos. */
const empleadoCon = async (negocio, permisos) => {
  const usuario = await crearUsuario();
  const rol = await crearRol(negocio, permisos);
  await crearEmpleado(negocio, { usuario, rol: rol.id_rol });
  return { rol, token: await tokenDe(usuario) };
};

const GESTOR = { roles: ["ver", "crear", "editar", "eliminar"], citas: ["ver", "crear"] };

describe("GET /negocios/:id_negocio/roles", () => {
  it("devuelve los del sistema y los propios, no los de otros negocios", async () => {
    const { negocio, token } = await negocioConToken();
    const propio = await crearRol(negocio, { citas: ["ver"] }, { nombre: "Auxiliar" });
    await crearEmpleado(negocio, { rol: propio.id_rol });
    await crearRol(await crearNegocio(), {}, { nombre: "De otro negocio" });

    const res = await api(token).get(`/negocios/${negocio.id_negocio}/roles`);
    expect(res.status).toBe(200);
    const nombres = res.body.data.map((r) => r.nombre);
    expect(nombres).toEqual(["Administrador", "Recepcionista", "Veterinario", "Auxiliar"]);
    expect(res.body.data[0]).toMatchObject({ es_sistema: true, id_negocio: null });
    expect(res.body.data[3]).toMatchObject({
      id_rol: propio.id_rol,
      es_sistema: false,
      permisos_json: { citas: ["ver"] },
      empleados_activos: 1,
    });
  });

  it("401 sin token, 403 sin roles.ver, 404 negocio inexistente", async () => {
    const { negocio, token } = await negocioConToken();
    expect((await api().get(`/negocios/${negocio.id_negocio}/roles`)).status).toBe(401);
    const { token: sinPermiso } = await empleadoCon(negocio, { citas: ["ver"] });
    expect((await api(sinPermiso).get(`/negocios/${negocio.id_negocio}/roles`)).status).toBe(403);
    expect((await api(token).get("/negocios/999999/roles")).status).toBe(404);
  });
});

describe("POST /negocios/:id_negocio/roles", () => {
  it("el propietario crea un rol con permisos del catálogo (sin repetidos)", async () => {
    const { negocio, token } = await negocioConToken();
    const res = await api(token)
      .post(`/negocios/${negocio.id_negocio}/roles`)
      .send({ nombre: "Peluquero", permisos_json: { citas: ["ver", "ver", "editar"], servicios: ["ver"] } });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      id_negocio: negocio.id_negocio,
      nombre: "Peluquero",
      descripcion: null,
      es_sistema: false,
      permisos_json: { citas: ["ver", "editar"], servicios: ["ver"] },
    });
  });

  it("permisos fuera del catálogo -> 422", async () => {
    const { negocio, token } = await negocioConToken();
    const res = await api(token)
      .post(`/negocios/${negocio.id_negocio}/roles`)
      .send({ nombre: "Raro", permisos_json: { horarios: ["ver"], citas: ["borrar"] } });
    expect(res.status).toBe(422);
    expect(res.body.errors).toMatchObject({
      "permisos_json.horarios": "Campo no permitido",
      "permisos_json.citas.0": expect.any(String),
    });

    expect((await api(token).post(`/negocios/${negocio.id_negocio}/roles`).send({ nombre: "Sin permisos" })).status).toBe(422);
  });

  it("nombre repetido en el negocio o igual a un rol del sistema -> 409", async () => {
    const { negocio, token } = await negocioConToken();
    await crearRol(negocio, {}, { nombre: "Cajero" });
    const url = `/negocios/${negocio.id_negocio}/roles`;

    const repetido = await api(token).post(url).send({ nombre: "cajero", permisos_json: {} });
    expect(repetido.status).toBe(409);
    expect(repetido.body.errors).toEqual({ nombre: "Nombre en uso" });

    expect((await api(token).post(url).send({ nombre: "Veterinario", permisos_json: {} })).status).toBe(409);

    // El mismo nombre en otro negocio sí se permite.
    const otro = await negocioConToken();
    expect((await api(otro.token).post(`/negocios/${otro.negocio.id_negocio}/roles`).send({ nombre: "Cajero", permisos_json: {} })).status).toBe(201);
  });

  it("escalada: un empleado no puede otorgar permisos que no tiene", async () => {
    const { negocio } = await negocioConToken();
    const { token } = await empleadoCon(negocio, GESTOR);
    const url = `/negocios/${negocio.id_negocio}/roles`;

    const subconjunto = await api(token).post(url).send({ nombre: "Ayudante", permisos_json: { citas: ["ver"] } });
    expect(subconjunto.status).toBe(201);

    const escalada = await api(token).post(url).send({ nombre: "Jefe", permisos_json: { citas: ["ver", "cancelar"] } });
    expect(escalada.status).toBe(403);
    expect(escalada.body.message).toBe("No puedes otorgar permisos que tu rol no tiene");

    const otroModulo = await api(token).post(url).send({ nombre: "Contador", permisos_json: { pagos: ["ver"] } });
    expect(otroModulo.status).toBe(403);
  });

  it("401 sin token y 403 sin roles.crear", async () => {
    const { negocio } = await negocioConToken();
    const url = `/negocios/${negocio.id_negocio}/roles`;
    expect((await api().post(url).send({ nombre: "X1", permisos_json: {} })).status).toBe(401);
    const { token } = await empleadoCon(negocio, { roles: ["ver"] });
    expect((await api(token).post(url).send({ nombre: "X1", permisos_json: {} })).status).toBe(403);
  });
});

describe("PATCH /roles/:id_rol", () => {
  it("el propietario edita nombre, descripción y permisos", async () => {
    const { negocio, token } = await negocioConToken();
    const rol = await crearRol(negocio, { citas: ["ver"] });
    const res = await api(token)
      .patch(`/roles/${rol.id_rol}`)
      .send({ nombre: "Renombrado", descripcion: "Nueva", permisos_json: { clientes: ["ver"] } });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ nombre: "Renombrado", descripcion: "Nueva", permisos_json: { clientes: ["ver"] } });

    // Mantener el mismo nombre no choca consigo mismo.
    expect((await api(token).patch(`/roles/${rol.id_rol}`).send({ nombre: "Renombrado" })).status).toBe(200);
  });

  it("los roles del sistema no se editan: 403 para el negocio y también para el admin", async () => {
    const { token } = await negocioConToken();
    const idVeterinario = await rolDelSistema("Veterinario");
    expect((await api(token).patch(`/roles/${idVeterinario}`).send({ nombre: "Vet" })).status).toBe(403);

    const admin = await api(await tokenDe(await crearAdmin())).patch(`/roles/${idVeterinario}`).send({ nombre: "Vet" });
    expect(admin.status).toBe(403);
    expect(admin.body.message).toBe("Los roles del sistema no se pueden modificar ni eliminar");
  });

  it("escalada: un empleado no edita su propio rol ni uno con más permisos, ni otorga los que no tiene", async () => {
    const { negocio } = await negocioConToken();
    const { rol: rolPropio, token } = await empleadoCon(negocio, GESTOR);
    const menor = await crearRol(negocio, { citas: ["ver"] });
    const mayor = await crearRol(negocio, { citas: ["ver"], pagos: ["ver"] });

    const propio = await api(token).patch(`/roles/${rolPropio.id_rol}`).send({ permisos_json: { ...GESTOR, pagos: ["ver"] } });
    expect(propio.status).toBe(403);
    expect(propio.body.message).toBe("No puedes modificar tu propio rol");

    expect((await api(token).patch(`/roles/${mayor.id_rol}`).send({ nombre: "Otro nombre" })).status).toBe(403);
    expect((await api(token).patch(`/roles/${menor.id_rol}`).send({ permisos_json: { citas: ["cancelar"] } })).status).toBe(403);
    expect((await api(token).patch(`/roles/${menor.id_rol}`).send({ permisos_json: { citas: ["ver", "crear"] } })).status).toBe(200);
  });

  it("nombre en uso -> 409; body vacío o campos desconocidos -> 422", async () => {
    const { negocio, token } = await negocioConToken();
    await crearRol(negocio, {}, { nombre: "Ocupado" });
    const rol = await crearRol(negocio, {});

    expect((await api(token).patch(`/roles/${rol.id_rol}`).send({ nombre: "OCUPADO" })).status).toBe(409);
    expect((await api(token).patch(`/roles/${rol.id_rol}`).send({ nombre: "Recepcionista" })).status).toBe(409);
    expect((await api(token).patch(`/roles/${rol.id_rol}`).send({})).status).toBe(422);
    expect((await api(token).patch(`/roles/${rol.id_rol}`).send({ es_sistema: true })).status).toBe(422);
  });

  it("401 sin token, 403 rol de otro negocio, 404 inexistente", async () => {
    const { negocio, token } = await negocioConToken();
    const rol = await crearRol(negocio, {});
    expect((await api().patch(`/roles/${rol.id_rol}`).send({ nombre: "Nuevo" })).status).toBe(401);
    const ajeno = await tokenDe((await crearNegocio()).propietario);
    expect((await api(ajeno).patch(`/roles/${rol.id_rol}`).send({ nombre: "Nuevo" })).status).toBe(403);
    expect((await api(token).patch("/roles/999999").send({ nombre: "Nuevo" })).status).toBe(404);
  });
});

describe("DELETE /roles/:id_rol", () => {
  it("elimina un rol sin empleados", async () => {
    const { negocio, token } = await negocioConToken();
    const rol = await crearRol(negocio, {});
    const res = await api(token).delete(`/roles/${rol.id_rol}`);
    expect(res.status).toBe(200);
    const [filas] = await pool.query("SELECT 1 FROM roles WHERE id_rol = ?", [rol.id_rol]);
    expect(filas).toHaveLength(0);
  });

  it("con empleados asignados (aunque estén inactivos) -> 409", async () => {
    const { negocio, token } = await negocioConToken();
    const rol = await crearRol(negocio, {});
    await crearEmpleado(negocio, { rol: rol.id_rol, activo: false });
    const res = await api(token).delete(`/roles/${rol.id_rol}`);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/1 empleado con este rol/);
  });

  it("rol del sistema -> 403; escalada: empleado no borra un rol con más permisos", async () => {
    const { negocio, token } = await negocioConToken();
    expect((await api(token).delete(`/roles/${await rolDelSistema("Recepcionista")}`)).status).toBe(403);

    const { token: gestor } = await empleadoCon(negocio, GESTOR);
    const mayor = await crearRol(negocio, { empleados: ["ver"] });
    const menor = await crearRol(negocio, { citas: ["ver"] });
    expect((await api(gestor).delete(`/roles/${mayor.id_rol}`)).status).toBe(403);
    expect((await api(gestor).delete(`/roles/${menor.id_rol}`)).status).toBe(200);
  });

  it("401 sin token, 403 sin roles.eliminar, 404 inexistente", async () => {
    const { negocio, token } = await negocioConToken();
    const rol = await crearRol(negocio, {});
    expect((await api().delete(`/roles/${rol.id_rol}`)).status).toBe(401);
    const { token: sinPermiso } = await empleadoCon(negocio, { roles: ["ver", "editar"] });
    expect((await api(sinPermiso).delete(`/roles/${rol.id_rol}`)).status).toBe(403);
    expect((await api(token).delete("/roles/999999")).status).toBe(404);
  });
});
