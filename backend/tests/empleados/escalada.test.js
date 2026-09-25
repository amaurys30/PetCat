import { describe, expect, it } from "vitest";
import { api } from "../helpers/api.js";
import { crearEmpleado, crearNegocio, crearRol, crearUsuario, rolDelSistema, tokenDe } from "../helpers/factories.js";

// Gestor de personal: puede todo sobre empleados, pero sus permisos no incluyen pagos ni roles.
const GESTOR = { empleados: ["ver", "crear", "editar", "eliminar"], citas: ["ver", "crear"] };

const escenario = async () => {
  const negocio = await crearNegocio();
  const usuario = await crearUsuario();
  const rolGestor = await crearRol(negocio, GESTOR);
  const gestor = await crearEmpleado(negocio, { usuario, rol: rolGestor.id_rol });
  const menor = await crearRol(negocio, { citas: ["ver"] });
  const mayor = await crearRol(negocio, { citas: ["ver"], pagos: ["ver"] });
  return { negocio, gestor, rolGestor, menor, mayor, token: await tokenDe(usuario) };
};

describe("escalada de privilegios en empleados", () => {
  it("al crear: un empleado no asigna un rol con permisos que el suyo no tiene", async () => {
    const { negocio, menor, mayor, token } = await escenario();
    const url = `/negocios/${negocio.id_negocio}/empleados`;

    expect((await api(token).post(url).send({ nombre: "Ana", apellido: "Mora", id_rol: menor.id_rol })).status).toBe(201);

    const escalada = await api(token).post(url).send({ nombre: "Ana", apellido: "Mora", id_rol: mayor.id_rol });
    expect(escalada.status).toBe(403);
    expect(escalada.body.message).toBe("No puedes asignar un rol con permisos que tu rol no tiene");

    const admin = await api(token).post(url).send({ nombre: "Ana", apellido: "Mora", id_rol: await rolDelSistema("Administrador") });
    expect(admin.status).toBe(403);
  });

  it("al editar: no asigna un rol mayor al suyo; sí uno contenido en sus permisos", async () => {
    const { negocio, menor, mayor, token } = await escenario();
    const otro = await crearEmpleado(negocio, { rol: menor.id_rol });

    expect((await api(token).patch(`/empleados/${otro.id_empleado}`).send({ id_rol: mayor.id_rol })).status).toBe(403);
    const permitido = await crearRol(negocio, { citas: ["ver", "crear"] });
    expect((await api(token).patch(`/empleados/${otro.id_empleado}`).send({ id_rol: permitido.id_rol })).status).toBe(200);
  });

  it("no puede cambiar su propio rol, aunque sea a uno menor; sí editar sus demás datos", async () => {
    const { gestor, menor, rolGestor, token } = await escenario();
    const propio = await api(token).patch(`/empleados/${gestor.id_empleado}`).send({ id_rol: menor.id_rol });
    expect(propio.status).toBe(403);
    expect(propio.body.message).toBe("No puedes cambiar tu propio rol");

    // Enviar el mismo rol que ya tiene no es un cambio.
    expect((await api(token).patch(`/empleados/${gestor.id_empleado}`).send({ id_rol: rolGestor.id_rol, telefono: "3001234567" })).status).toBe(200);
  });

  it("no puede editar, desactivar ni reactivar a un empleado con permisos que él no tiene", async () => {
    const { negocio, mayor, token } = await escenario();
    const superior = await crearEmpleado(negocio, { rol: mayor.id_rol });
    const superiorInactivo = await crearEmpleado(negocio, { rol: "Administrador", activo: false });

    const editar = await api(token).patch(`/empleados/${superior.id_empleado}`).send({ nombre: "Cambiado" });
    expect(editar.status).toBe(403);
    expect(editar.body.message).toBe("No puedes modificar a un empleado con permisos que tu rol no tiene");
    expect((await api(token).delete(`/empleados/${superior.id_empleado}`)).status).toBe(403);
    expect((await api(token).patch(`/empleados/${superiorInactivo.id_empleado}/reactivar`)).status).toBe(403);
  });

  it("sí puede desactivar y reactivar a un empleado con permisos contenidos en los suyos", async () => {
    const { negocio, menor, token } = await escenario();
    const subordinado = await crearEmpleado(negocio, { rol: menor.id_rol });
    expect((await api(token).delete(`/empleados/${subordinado.id_empleado}`)).status).toBe(200);
    expect((await api(token).patch(`/empleados/${subordinado.id_empleado}/reactivar`)).status).toBe(200);
  });

  it("no puede desactivarse a sí mismo", async () => {
    const { gestor, token } = await escenario();
    const res = await api(token).delete(`/empleados/${gestor.id_empleado}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("No puedes desactivarte a ti mismo");
  });

  it("el propietario no tiene esos límites, también como empleado de su propio negocio", async () => {
    const negocio = await crearNegocio();
    const tokenPropietario = await tokenDe(negocio.propietario);
    const comoEmpleado = await crearEmpleado(negocio, { usuario: negocio.propietario, rol: "Veterinario" });
    const admin = await rolDelSistema("Administrador");

    // Cambia su propio rol y se desactiva como empleado: sigue siendo el propietario.
    expect((await api(tokenPropietario).patch(`/empleados/${comoEmpleado.id_empleado}`).send({ id_rol: admin })).status).toBe(200);
    expect((await api(tokenPropietario).delete(`/empleados/${comoEmpleado.id_empleado}`)).status).toBe(200);
    expect((await api(tokenPropietario).get(`/negocios/${negocio.id_negocio}/empleados`)).status).toBe(200);

    // /negocios/mios lo sigue mostrando una sola vez, como propietario.
    const mios = await api(tokenPropietario).get("/negocios/mios");
    expect(mios.body.data.filter((n) => n.id_negocio === negocio.id_negocio)).toEqual([
      expect.objectContaining({ relacion: "propietario" }),
    ]);
  });
});
