import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { api } from "../helpers/api.js";
import {
  crearEmpleado,
  crearInvitacion,
  crearNegocio,
  crearRol,
  crearUsuario,
  rolDelSistema,
  tokenDe,
  unique,
} from "../helpers/factories.js";

const negocioConToken = async () => {
  const negocio = await crearNegocio();
  return { negocio, token: await tokenDe(negocio.propietario) };
};

const invitacionVigente = async (id_empleado) => {
  const [[{ vigentes }]] = await pool.query(
    "SELECT COUNT(*) AS vigentes FROM invitaciones_empleado WHERE id_empleado = ? AND usado = FALSE AND expiracion > NOW()",
    [id_empleado]
  );
  return vigentes > 0;
};

describe("GET /negocios/:id_negocio/empleados", () => {
  it("pagina, ordena activos primero y trae rol, cuenta e invitación", async () => {
    const { negocio, token } = await negocioConToken();
    const usuario = await crearUsuario();
    const vinculado = await crearEmpleado(negocio, { usuario, apellido: "Zapata" });
    const conInvitacion = await crearEmpleado(negocio, { rol: "Recepcionista", apellido: "Álvarez" });
    await crearInvitacion(conInvitacion);
    const inactivo = await crearEmpleado(negocio, { activo: false, apellido: "Acosta" });
    await crearEmpleado(await crearNegocio()); // de otro negocio

    const res = await api(token).get(`/negocios/${negocio.id_negocio}/empleados?limit=2`);
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ total: 3, page: 1, limit: 2, totalPages: 2, hasNext: true });
    expect(res.body.data.map((e) => e.id_empleado)).toEqual([conInvitacion.id_empleado, vinculado.id_empleado]);
    expect(res.body.data[0]).toMatchObject({
      activo: true,
      tiene_cuenta: false,
      invitacion_pendiente: true,
      rol: { id_rol: await rolDelSistema("Recepcionista"), nombre: "Recepcionista" },
    });
    expect(res.body.data[0].rol).not.toHaveProperty("permisos_json");
    expect(res.body.data[1]).toMatchObject({ tiene_cuenta: true, id_usuario: usuario.id_usuario, invitacion_pendiente: false });

    const pagina2 = await api(token).get(`/negocios/${negocio.id_negocio}/empleados?limit=2&page=2`);
    expect(pagina2.body.data.map((e) => e.id_empleado)).toEqual([inactivo.id_empleado]);
    expect(pagina2.body.meta.hasNext).toBe(false);
  });

  it("filtra por activo y por q (nombre, apellido, nombre completo, email, documento)", async () => {
    const { negocio, token } = await negocioConToken();
    const marta = await crearEmpleado(negocio, { nombre: "Marta", apellido: "Ríos", documento: "1102003004" });
    const pedro = await crearEmpleado(negocio, { nombre: "Pedro", apellido: "Gil", email: `pedro_${unique()}@vet.test` });
    const retirado = await crearEmpleado(negocio, { nombre: "Marta", apellido: "Vega", activo: false });
    const url = `/negocios/${negocio.id_negocio}/empleados`;
    const ids = async (query) => (await api(token).get(`${url}?${query}`)).body.data.map((e) => e.id_empleado).sort();

    expect(await ids("activo=true")).toEqual([marta.id_empleado, pedro.id_empleado].sort());
    expect(await ids("activo=false")).toEqual([retirado.id_empleado]);
    expect(await ids("q=marta")).toEqual([marta.id_empleado, retirado.id_empleado].sort());
    expect(await ids("q=marta&activo=true")).toEqual([marta.id_empleado]);
    expect(await ids("q=Marta%20R")).toEqual([marta.id_empleado]);
    expect(await ids("q=1102003")).toEqual([marta.id_empleado]);
    expect(await ids("q=@vet.test")).toEqual([pedro.id_empleado]);
    // Los comodines de LIKE se buscan como texto.
    expect(await ids("q=%25")).toEqual([]);
  });

  it("query inválido -> 422; sin token -> 401; sin empleados.ver -> 403; negocio inexistente -> 404", async () => {
    const { negocio, token } = await negocioConToken();
    const url = `/negocios/${negocio.id_negocio}/empleados`;

    const invalido = await api(token).get(`${url}?activo=si&limit=500`);
    expect(invalido.status).toBe(422);
    expect(Object.keys(invalido.body.errors).sort()).toEqual(["activo", "limit"]);

    expect((await api().get(url)).status).toBe(401);
    const recepcion = await crearUsuario();
    await crearEmpleado(negocio, { usuario: recepcion, rol: "Recepcionista" });
    expect((await api(await tokenDe(recepcion)).get(url)).status).toBe(403);
    expect((await api(token).get("/negocios/999999/empleados")).status).toBe(404);
  });
});

describe("POST /negocios/:id_negocio/empleados", () => {
  it("crea con rol del sistema o propio; fecha de vinculación por defecto hoy", async () => {
    const { negocio, token } = await negocioConToken();
    const email = `nuevo_${unique()}@vet.test`;
    const res = await api(token)
      .post(`/negocios/${negocio.id_negocio}/empleados`)
      .send({ nombre: "Laura", apellido: "Díaz", email: ` ${email.toUpperCase()} `, id_rol: await rolDelSistema("Veterinario") });

    expect(res.status).toBe(201);
    const [[{ hoy }]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoy");
    expect(res.body.data).toMatchObject({
      id_negocio: negocio.id_negocio,
      nombre: "Laura",
      email,
      activo: true,
      tiene_cuenta: false,
      id_usuario: null,
      fecha_vinculacion: hoy,
      rol: { nombre: "Veterinario", permisos_json: expect.any(Object) },
    });

    const propio = await crearRol(negocio, { citas: ["ver"] });
    const conRolPropio = await api(token)
      .post(`/negocios/${negocio.id_negocio}/empleados`)
      .send({ nombre: "Ana", apellido: "Mora", id_rol: propio.id_rol, fecha_vinculacion: "2026-01-15" });
    expect(conRolPropio.status).toBe(201);
    expect(conRolPropio.body.data).toMatchObject({ fecha_vinculacion: "2026-01-15", email: null });
  });

  it("id_rol de otro negocio o inexistente -> 422", async () => {
    const { negocio, token } = await negocioConToken();
    const ajeno = await crearRol(await crearNegocio(), {});
    for (const id_rol of [ajeno.id_rol, 999999]) {
      const res = await api(token)
        .post(`/negocios/${negocio.id_negocio}/empleados`)
        .send({ nombre: "Ana", apellido: "Mora", id_rol });
      expect(res.status, String(id_rol)).toBe(422);
      expect(res.body.errors).toEqual({ id_rol: "El rol no existe en este negocio" });
    }
  });

  it("no acepta id_usuario, id_negocio, activo ni fecha_retiro; valida campos -> 422", async () => {
    const { negocio, token } = await negocioConToken();
    const res = await api(token)
      .post(`/negocios/${negocio.id_negocio}/empleados`)
      .send({ nombre: "Ana", apellido: "Mora", id_rol: 1, id_usuario: 1, id_negocio: 1, activo: false, fecha_retiro: "2026-01-01" });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.errors).sort()).toEqual(["activo", "fecha_retiro", "id_negocio", "id_usuario"]);

    const invalido = await api(token)
      .post(`/negocios/${negocio.id_negocio}/empleados`)
      .send({ nombre: "A", email: "malo", fecha_vinculacion: "2026-02-30" });
    expect(invalido.status).toBe(422);
    expect(Object.keys(invalido.body.errors).sort()).toEqual(["apellido", "email", "fecha_vinculacion", "id_rol", "nombre"]);
  });

  it("email único por negocio: 409 en el mismo negocio (sin distinguir mayúsculas), válido en otro", async () => {
    const { negocio, token } = await negocioConToken();
    const existente = await crearEmpleado(negocio);
    const body = { nombre: "Otra", apellido: "Persona", email: existente.email.toUpperCase(), id_rol: await rolDelSistema("Veterinario") };

    const res = await api(token).post(`/negocios/${negocio.id_negocio}/empleados`).send(body);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ message: "Ya existe un empleado con ese email en el negocio", errors: { email: "Ya está en uso" } });

    const otro = await negocioConToken();
    expect((await api(otro.token).post(`/negocios/${otro.negocio.id_negocio}/empleados`).send(body)).status).toBe(201);
  });

  it("email de un empleado inactivo -> 409 que indica que se puede reactivar", async () => {
    const { negocio, token } = await negocioConToken();
    const inactivo = await crearEmpleado(negocio, { activo: false });
    const res = await api(token)
      .post(`/negocios/${negocio.id_negocio}/empleados`)
      .send({ nombre: "Otra", apellido: "Vez", email: inactivo.email, id_rol: await rolDelSistema("Veterinario") });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain(`id_empleado ${inactivo.id_empleado}`);
    expect(res.body.message).toContain("reactivarlo");
    expect(res.body.errors.email).toContain(`/empleados/${inactivo.id_empleado}/reactivar`);
  });

  it("401 sin token y 403 sin empleados.crear", async () => {
    const { negocio } = await negocioConToken();
    const body = { nombre: "Ana", apellido: "Mora", id_rol: await rolDelSistema("Veterinario") };
    expect((await api().post(`/negocios/${negocio.id_negocio}/empleados`).send(body)).status).toBe(401);
    const vet = await crearUsuario();
    await crearEmpleado(negocio, { usuario: vet });
    expect((await api(await tokenDe(vet)).post(`/negocios/${negocio.id_negocio}/empleados`).send(body)).status).toBe(403);
  });
});

describe("GET /empleados/:id_empleado", () => {
  it("detalle con permisos del rol; 401, 403 de otro negocio, 404 y 422", async () => {
    const { negocio, token } = await negocioConToken();
    const empleado = await crearEmpleado(negocio, { rol: "Recepcionista" });

    const res = await api(token).get(`/empleados/${empleado.id_empleado}`);
    expect(res.status).toBe(200);
    expect(res.body.data.rol.permisos_json).toHaveProperty("citas");

    expect((await api().get(`/empleados/${empleado.id_empleado}`)).status).toBe(401);
    const ajeno = await tokenDe((await crearNegocio()).propietario);
    expect((await api(ajeno).get(`/empleados/${empleado.id_empleado}`)).status).toBe(403);
    expect((await api(token).get("/empleados/999999")).status).toBe(404);
    expect((await api(token).get("/empleados/abc")).status).toBe(422);
  });
});

describe("PATCH /empleados/:id_empleado", () => {
  it("actualiza campos de la lista blanca y cambia el rol", async () => {
    const { negocio, token } = await negocioConToken();
    const empleado = await crearEmpleado(negocio);
    const res = await api(token)
      .patch(`/empleados/${empleado.id_empleado}`)
      .send({ especialidad: "Cirugía", telefono: null, id_rol: await rolDelSistema("Administrador") });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ especialidad: "Cirugía", telefono: null, rol: { nombre: "Administrador" } });
  });

  it("cambiar el email invalida las invitaciones pendientes; otros cambios no", async () => {
    const { negocio, token } = await negocioConToken();
    const empleado = await crearEmpleado(negocio);
    await crearInvitacion(empleado);

    await api(token).patch(`/empleados/${empleado.id_empleado}`).send({ nombre: "Renombrado" });
    expect(await invitacionVigente(empleado.id_empleado)).toBe(true);

    // Mismo email con otras mayúsculas no cuenta como cambio.
    await api(token).patch(`/empleados/${empleado.id_empleado}`).send({ email: empleado.email.toUpperCase() });
    expect(await invitacionVigente(empleado.id_empleado)).toBe(true);

    const res = await api(token).patch(`/empleados/${empleado.id_empleado}`).send({ email: `nuevo_${unique()}@vet.test` });
    expect(res.status).toBe(200);
    expect(res.body.data.invitacion_pendiente).toBe(false);
    expect(await invitacionVigente(empleado.id_empleado)).toBe(false);
  });

  it("email de otro empleado del negocio -> 409; rol de otro negocio -> 422", async () => {
    const { negocio, token } = await negocioConToken();
    const a = await crearEmpleado(negocio);
    const b = await crearEmpleado(negocio);
    expect((await api(token).patch(`/empleados/${a.id_empleado}`).send({ email: b.email })).status).toBe(409);

    const ajeno = await crearRol(await crearNegocio(), {});
    const res = await api(token).patch(`/empleados/${a.id_empleado}`).send({ id_rol: ajeno.id_rol });
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({ id_rol: "El rol no existe en este negocio" });
  });

  it("no acepta id_usuario, id_negocio ni activo; body vacío -> 422", async () => {
    const { negocio, token } = await negocioConToken();
    const empleado = await crearEmpleado(negocio);
    const res = await api(token).patch(`/empleados/${empleado.id_empleado}`).send({ id_usuario: 1, id_negocio: 1, activo: true });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.errors).sort()).toEqual(["activo", "id_negocio", "id_usuario"]);
    expect((await api(token).patch(`/empleados/${empleado.id_empleado}`).send({})).status).toBe(422);
  });

  it("401, 403 sin empleados.editar y 404", async () => {
    const { negocio, token } = await negocioConToken();
    const empleado = await crearEmpleado(negocio);
    expect((await api().patch(`/empleados/${empleado.id_empleado}`).send({ nombre: "Otro" })).status).toBe(401);
    const recepcion = await crearUsuario();
    await crearEmpleado(negocio, { usuario: recepcion, rol: "Recepcionista" });
    expect((await api(await tokenDe(recepcion)).patch(`/empleados/${empleado.id_empleado}`).send({ nombre: "Otro" })).status).toBe(403);
    expect((await api(token).patch("/empleados/999999").send({ nombre: "Otro" })).status).toBe(404);
  });
});

describe("DELETE /empleados/:id_empleado y PATCH /empleados/:id_empleado/reactivar", () => {
  it("desactiva (fecha_retiro hoy), invalida invitaciones y quita el acceso al panel; luego reactiva", async () => {
    const { negocio, token } = await negocioConToken();
    const usuario = await crearUsuario();
    const empleado = await crearEmpleado(negocio, { usuario, rol: "Administrador" });
    await crearInvitacion(empleado);
    const tokenEmpleado = await tokenDe(usuario);
    expect((await api(tokenEmpleado).get(`/negocios/${negocio.id_negocio}/empleados`)).status).toBe(200);

    const res = await api(token).delete(`/empleados/${empleado.id_empleado}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Empleado desactivado");
    const [[{ hoy }]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoy");
    expect(res.body.data).toMatchObject({ activo: false, fecha_retiro: hoy, invitacion_pendiente: false });
    expect(await invitacionVigente(empleado.id_empleado)).toBe(false);
    expect((await api(tokenEmpleado).get(`/negocios/${negocio.id_negocio}/empleados`)).status).toBe(403);

    expect((await api(token).delete(`/empleados/${empleado.id_empleado}`)).status).toBe(409);

    const reactivado = await api(token).patch(`/empleados/${empleado.id_empleado}/reactivar`);
    expect(reactivado.status).toBe(200);
    expect(reactivado.body.data).toMatchObject({ activo: true, fecha_retiro: null });
    expect((await api(tokenEmpleado).get(`/negocios/${negocio.id_negocio}/empleados`)).status).toBe(200);

    expect((await api(token).patch(`/empleados/${empleado.id_empleado}/reactivar`)).status).toBe(409);
  });

  it("401, 403 sin el permiso y 404", async () => {
    const { negocio, token } = await negocioConToken();
    const empleado = await crearEmpleado(negocio);
    const recepcion = await crearUsuario();
    await crearEmpleado(negocio, { usuario: recepcion, rol: "Recepcionista" });
    const tokenRecepcion = await tokenDe(recepcion);

    expect((await api().delete(`/empleados/${empleado.id_empleado}`)).status).toBe(401);
    expect((await api(tokenRecepcion).delete(`/empleados/${empleado.id_empleado}`)).status).toBe(403);
    expect((await api(tokenRecepcion).patch(`/empleados/${empleado.id_empleado}/reactivar`)).status).toBe(403);
    expect((await api(token).delete("/empleados/999999")).status).toBe(404);
    expect((await api(token).patch("/empleados/999999/reactivar")).status).toBe(404);
  });
});

describe("restricciones de la base (migración 001)", () => {
  it("un usuario no puede quedar vinculado dos veces al mismo negocio; sí a negocios distintos", async () => {
    const negocio = await crearNegocio();
    const usuario = await crearUsuario();
    await crearEmpleado(negocio, { usuario });
    await expect(crearEmpleado(negocio, { usuario, email: `otro_${unique()}@vet.test` })).rejects.toMatchObject({
      code: "ER_DUP_ENTRY",
    });
    await expect(crearEmpleado(await crearNegocio(), { usuario })).resolves.toBeDefined();
  });

  it("varios empleados sin email en el mismo negocio están permitidos", async () => {
    const negocio = await crearNegocio();
    await crearEmpleado(negocio, { email: null });
    await expect(crearEmpleado(negocio, { email: null })).resolves.toBeDefined();
  });
});
