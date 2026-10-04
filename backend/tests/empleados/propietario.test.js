import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { api } from "../helpers/api.js";
import {
  crearAdmin,
  crearEmpleado,
  crearInvitacion,
  crearNegocio,
  crearUsuario,
  rolDelSistema,
  tokenDe,
} from "../helpers/factories.js";

const escenario = async () => {
  const propietario = await crearUsuario({ nombre: "Laura", apellido: "Martínez" });
  const negocio = await crearNegocio(propietario);
  return { negocio, propietario, token: await tokenDe(propietario), url: `/negocios/${negocio.id_negocio}/empleados/yo` };
};

describe("POST /negocios/:id_negocio/empleados/yo", () => {
  it("crea el empleado vinculado con los datos de su cuenta y rol Administrador por defecto", async () => {
    const { negocio, propietario, token, url } = await escenario();
    const antes = await api(token).get("/negocios/mios");
    expect(antes.body.data.find((n) => n.id_negocio === negocio.id_negocio).id_empleado).toBeNull();
    const res = await api(token).post(url).send({ especialidad: "Cirugía", registro_profesional: "MVZ-999" });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      id_negocio: negocio.id_negocio,
      id_usuario: propietario.id_usuario,
      nombre: "Laura",
      apellido: "Martínez",
      email: propietario.email,
      especialidad: "Cirugía",
      tiene_cuenta: true,
      rol: { nombre: "Administrador" },
    });

    // Aparece en el listado del negocio y sigue entrando como propietario.
    const lista = await api(token).get(`/negocios/${negocio.id_negocio}/empleados`);
    expect(lista.body.data.map((e) => e.id_usuario)).toContain(propietario.id_usuario);
    const mios = await api(token).get("/negocios/mios");
    expect(mios.body.data.find((n) => n.id_negocio === negocio.id_negocio)).toMatchObject({
      relacion: "propietario",
      id_empleado: res.body.data.id_empleado,
      rol: null,
    });
    expect(lista.body.data.find((e) => e.id_usuario === propietario.id_usuario).es_propietario).toBe(true);

    // Inactivo, /mios lo sigue indicando (el panel ofrece reactivarlo).
    await api(token).delete(`/empleados/${res.body.data.id_empleado}`);
    const despues = await api(token).get("/negocios/mios");
    expect(despues.body.data.find((n) => n.id_negocio === negocio.id_negocio).id_empleado).toBe(res.body.data.id_empleado);
  });

  it("acepta otro rol del sistema o del negocio; rol ajeno -> 422", async () => {
    const { token, url } = await escenario();
    const res = await api(token).post(url).send({ id_rol: await rolDelSistema("Veterinario") });
    expect(res.status).toBe(201);
    expect(res.body.data.rol.nombre).toBe("Veterinario");

    const otro = await escenario();
    const ajeno = await api(otro.token).post(otro.url).send({ id_rol: 999999 });
    expect(ajeno.status).toBe(422);
  });

  it("si ya existe un empleado sin cuenta con su email, lo vincula en lugar de crear otro", async () => {
    const { negocio, propietario, token, url } = await escenario();
    const existente = await crearEmpleado(negocio, { email: propietario.email, rol: "Veterinario", nombre: "Lau" });
    await crearInvitacion(existente);

    const res = await api(token).post(url).send({ telefono: "3001112233" });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain("vinculada");
    expect(res.body.data).toMatchObject({
      id_empleado: existente.id_empleado,
      id_usuario: propietario.id_usuario,
      nombre: "Lau",
      telefono: "3001112233",
      invitacion_pendiente: false,
      rol: { nombre: "Veterinario" }, // conserva su rol si no se envía id_rol
    });
    const [filas] = await pool.query("SELECT 1 FROM empleados WHERE id_negocio = ?", [negocio.id_negocio]);
    expect(filas).toHaveLength(1);
  });

  it("409 si ya está registrado (activo o inactivo) o si el empleado con su email está inactivo", async () => {
    const a = await escenario();
    expect((await api(a.token).post(a.url).send({})).status).toBe(201);
    const repetido = await api(a.token).post(a.url).send({});
    expect(repetido.status).toBe(409);
    expect(repetido.body.message).toBe("Ya estás registrado como empleado de este negocio");

    const b = await escenario();
    const inactivoVinculado = await crearEmpleado(b.negocio, { usuario: b.propietario, activo: false });
    const res = await api(b.token).post(b.url).send({});
    expect(res.status).toBe(409);
    expect(res.body.message).toContain(`id_empleado ${inactivoVinculado.id_empleado}`);

    const c = await escenario();
    await crearEmpleado(c.negocio, { email: c.propietario.email, activo: false });
    const inactivo = await api(c.token).post(c.url).send({});
    expect(inactivo.status).toBe(409);
    expect(inactivo.body.message).toContain("reactívalo");
  });

  it("solo el propietario: empleado con empleados.crear y admin de plataforma -> 403", async () => {
    const { negocio, url } = await escenario();
    const gestor = await crearUsuario();
    await crearEmpleado(negocio, { usuario: gestor, rol: "Administrador" });

    const res = await api(await tokenDe(gestor)).post(url).send({});
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Solo el propietario puede registrarse como empleado de su negocio");
    expect((await api(await tokenDe(await crearAdmin())).post(url).send({})).status).toBe(403);
  });

  it("401 sin token, 404 negocio inexistente, 422 con nombre, email o id_usuario en el body", async () => {
    const { token, url } = await escenario();
    expect((await api().post(url).send({})).status).toBe(401);
    expect((await api(token).post("/negocios/999999/empleados/yo").send({})).status).toBe(404);

    const res = await api(token).post(url).send({ nombre: "Otro", email: "x@y.co", id_usuario: 1 });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.errors).sort()).toEqual(["email", "id_usuario", "nombre"]);
  });
});
