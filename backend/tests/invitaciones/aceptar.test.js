import { beforeEach, describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { comparePassword, hashToken } from "../../src/shared/utils/hash.js";
import { outbox, clearOutbox } from "../../src/shared/utils/mailer.js";
import { api } from "../helpers/api.js";
import { crearEmpleado, crearInvitacion, crearNegocio, crearUsuario, tokenDe, unique, PASSWORD } from "../helpers/factories.js";

// Token de la invitación demo del seed (documentado en dev_seed.sql).
const TOKEN_SEED = "5eed" + "0".repeat(59) + "1";

/** Crea un empleado, le envía la invitación por la API y devuelve el token del correo. */
const invitar = async (overridesEmpleado = {}) => {
  const negocio = await crearNegocio(null, { nombre: "Veterinaria Huellitas" });
  const empleado = await crearEmpleado(negocio, { rol: "Recepcionista", nombre: "Ana", apellido: "Rodríguez", ...overridesEmpleado });
  const tokenPropietario = await tokenDe(negocio.propietario);
  clearOutbox();
  const res = await api(tokenPropietario).post(`/empleados/${empleado.id_empleado}/invitacion`);
  expect(res.status).toBe(201);
  const token = /\/invitacion\/([0-9a-f]{64})/.exec(outbox[0].text)[1];
  return { negocio, empleado, token, tokenPropietario };
};

const empleadoDb = async (id_empleado) => {
  const [[row]] = await pool.query("SELECT id_usuario FROM empleados WHERE id_empleado = ?", [id_empleado]);
  return row;
};

beforeEach(() => clearOutbox());

describe("GET /invitaciones/:token", () => {
  it("público: negocio, rol, empleado, email y cuenta_existente", async () => {
    const { negocio, empleado, token } = await invitar();
    const res = await api().get(`/invitaciones/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      negocio: { id_negocio: negocio.id_negocio, nombre: "Veterinaria Huellitas", logo_url: null },
      rol: { nombre: "Recepcionista" },
      empleado: { nombre: "Ana", apellido: "Rodríguez" },
      email: empleado.email,
      cuenta_existente: false,
    });
    expect(JSON.stringify(res.body)).not.toContain(token);
  });

  it("cuenta_existente es true si el email ya tiene cuenta", async () => {
    const usuario = await crearUsuario();
    const { token } = await invitar({ email: usuario.email });
    expect((await api().get(`/invitaciones/${token}`)).body.data.cuenta_existente).toBe(true);
  });

  it("la invitación demo del seed funciona con su token documentado", async () => {
    const res = await api().get(`/invitaciones/${TOKEN_SEED}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: "recepcionista@petcat.test", rol: { nombre: "Recepcionista" } });
  });

  it("422 con formato inválido, 404 desconocido, 409 vencida o reemplazada", async () => {
    expect((await api().get("/invitaciones/no-es-un-token")).status).toBe(422);
    expect((await api().get(`/invitaciones/${"a".repeat(64)}`)).status).toBe(404);

    const { empleado, token, tokenPropietario } = await invitar();
    await api(tokenPropietario).post(`/empleados/${empleado.id_empleado}/invitacion/reenviar`);
    const reemplazada = await api().get(`/invitaciones/${token}`);
    expect(reemplazada.status).toBe(409);
    expect(reemplazada.body.message).toContain("venció o fue reemplazada");
  });

  it("409 si el empleado se desactivó después de invitarlo", async () => {
    const { empleado, token } = await invitar();
    await pool.query("UPDATE empleados SET activo = FALSE WHERE id_empleado = ?", [empleado.id_empleado]);
    const res = await api().get(`/invitaciones/${token}`);
    expect(res.status).toBe(409);
    expect(res.body.message).toContain("ya no está activo");
  });
});

describe("POST /invitaciones/:token/aceptar", () => {
  it("sin cuenta: crea el usuario verificado, vincula al empleado e inicia sesión", async () => {
    const { negocio, empleado, token } = await invitar();
    const res = await api()
      .post(`/invitaciones/${token}/aceptar`)
      .set("User-Agent", "PanelWeb/1.0")
      .send({ password: "NuevaClave1", telefono: "3004445566" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Invitación aceptada");
    expect(Object.keys(res.body.data).sort()).toEqual(["access_token", "refresh_token", "usuario"]);
    expect(res.body.data.usuario).toMatchObject({
      nombre: "Ana",
      apellido: "Rodríguez",
      email: empleado.email,
      telefono: "3004445566",
      email_verificado: true,
    });

    const [[usuario]] = await pool.query("SELECT * FROM usuarios WHERE email = ?", [empleado.email]);
    expect(await comparePassword("NuevaClave1", usuario.password_hash)).toBe(true);
    expect(usuario.ultimo_acceso).not.toBeNull();
    expect((await empleadoDb(empleado.id_empleado)).id_usuario).toBe(usuario.id_usuario);

    const [[invitacion]] = await pool.query(
      "SELECT usado, fecha_usado FROM invitaciones_empleado WHERE id_empleado = ?",
      [empleado.id_empleado]
    );
    expect(invitacion.usado).toBe(1);
    expect(invitacion.fecha_usado).not.toBeNull();

    // Auto-login: el token entra al panel con los permisos de su rol.
    const panel = await api(res.body.data.access_token).get(`/negocios/${negocio.id_negocio}/empleados`);
    expect(panel.status).toBe(403); // Recepcionista no tiene empleados.ver
    const mios = await api(res.body.data.access_token).get("/negocios/mios");
    expect(mios.body.data).toEqual([
      expect.objectContaining({ id_negocio: negocio.id_negocio, relacion: "empleado", rol: expect.objectContaining({ nombre: "Recepcionista" }) }),
    ]);
  });

  it("sin cuenta: nombre y apellido enviados reemplazan los del empleado; contraseña débil -> 422", async () => {
    const { token } = await invitar();
    const debil = await api().post(`/invitaciones/${token}/aceptar`).send({ password: "corta" });
    expect(debil.status).toBe(422);
    expect(debil.body.errors).toHaveProperty("password");

    const res = await api().post(`/invitaciones/${token}/aceptar`).send({ password: "NuevaClave1", nombre: "Anita", apellido: "Ruiz" });
    expect(res.status).toBe(200);
    expect(res.body.data.usuario).toMatchObject({ nombre: "Anita", apellido: "Ruiz" });
  });

  it("con cuenta: exige la contraseña actual y vincula esa cuenta", async () => {
    const usuario = await crearUsuario({ nombre: "Carlos" });
    const { empleado, token } = await invitar({ email: usuario.email });

    const erronea = await api().post(`/invitaciones/${token}/aceptar`).send({ password: "Incorrecta1" });
    expect(erronea.status).toBe(401);
    expect(erronea.body.message).toBe("Contraseña incorrecta");
    expect((await empleadoDb(empleado.id_empleado)).id_usuario).toBeNull();

    const res = await api().post(`/invitaciones/${token}/aceptar`).send({ password: PASSWORD, nombre: "Ignorado" });
    expect(res.status).toBe(200);
    expect(res.body.data.usuario).toMatchObject({ id_usuario: usuario.id_usuario, nombre: "Carlos" });
    expect((await empleadoDb(empleado.id_empleado)).id_usuario).toBe(usuario.id_usuario);
  });

  it("con cuenta: los fallos cuentan para el bloqueo del login (5 intentos)", async () => {
    const usuario = await crearUsuario();
    const { token } = await invitar({ email: usuario.email });
    for (let i = 0; i < 4; i++) {
      expect((await api().post(`/invitaciones/${token}/aceptar`).send({ password: "Incorrecta1" })).status).toBe(401);
    }
    expect((await api().post(`/invitaciones/${token}/aceptar`).send({ password: "Incorrecta1" })).status).toBe(403);
    // Bloqueada: ni aceptar ni el login funcionan con la contraseña correcta.
    expect((await api().post(`/invitaciones/${token}/aceptar`).send({ password: PASSWORD })).status).toBe(403);
    expect((await api().post("/auth/login").send({ email: usuario.email, password: PASSWORD })).status).toBe(403);
  });

  it("con cuenta desactivada -> 403", async () => {
    const usuario = await crearUsuario({ activo: false });
    const { token } = await invitar({ email: usuario.email });
    expect((await api().post(`/invitaciones/${token}/aceptar`).send({ password: PASSWORD })).status).toBe(403);
  });

  it("el mismo enlace no se puede usar dos veces", async () => {
    const { token } = await invitar();
    expect((await api().post(`/invitaciones/${token}/aceptar`).send({ password: "NuevaClave1" })).status).toBe(200);
    const otra = await api().post(`/invitaciones/${token}/aceptar`).send({ password: "NuevaClave1" });
    expect(otra.status).toBe(409);
    expect(otra.body.message).toBe("Esta invitación ya fue utilizada");
    expect((await api().get(`/invitaciones/${token}`)).status).toBe(409);
  });

  it("dos aceptaciones simultáneas con cuenta existente: una entra y la otra recibe 409 (FOR UPDATE)", async () => {
    const usuario = await crearUsuario();
    const { token } = await invitar({ email: usuario.email });
    const [a, b] = await Promise.all([
      api().post(`/invitaciones/${token}/aceptar`).send({ password: PASSWORD }),
      api().post(`/invitaciones/${token}/aceptar`).send({ password: PASSWORD }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const [sesiones] = await pool.query("SELECT 1 FROM sesiones WHERE id_usuario = ?", [usuario.id_usuario]);
    expect(sesiones).toHaveLength(1);
  });

  it("dos aceptaciones simultáneas sin cuenta: se crea un solo usuario", async () => {
    const { empleado, token } = await invitar();
    const [a, b] = await Promise.all([
      api().post(`/invitaciones/${token}/aceptar`).send({ password: "NuevaClave1" }),
      api().post(`/invitaciones/${token}/aceptar`).send({ password: "NuevaClave1" }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const [usuarios] = await pool.query("SELECT id_usuario FROM usuarios WHERE email = ?", [empleado.email]);
    expect(usuarios).toHaveLength(1);
  });

  it("invitación vencida -> 409 y no crea la cuenta", async () => {
    const { empleado, token } = await invitar();
    await pool.query("UPDATE invitaciones_empleado SET expiracion = NOW() - INTERVAL 1 MINUTE WHERE id_empleado = ?", [empleado.id_empleado]);
    expect((await api().post(`/invitaciones/${token}/aceptar`).send({ password: "NuevaClave1" })).status).toBe(409);
    const [usuarios] = await pool.query("SELECT 1 FROM usuarios WHERE email = ?", [empleado.email]);
    expect(usuarios).toHaveLength(0);
  });

  it("la cuenta ya está vinculada a otro empleado del mismo negocio -> 409", async () => {
    const usuario = await crearUsuario();
    const negocio = await crearNegocio();
    await crearEmpleado(negocio, { usuario });
    const otro = await crearEmpleado(negocio, { email: usuario.email.replace("@", "+2@") });
    // La invitación se crea a mano con el email de la cuenta (el del empleado es otro).
    const token = unique().padEnd(64, "0");
    await crearInvitacion(otro, { email: usuario.email, token: hashToken(token) });

    const res = await api().post(`/invitaciones/${token}/aceptar`).send({ password: PASSWORD });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Tu cuenta ya está vinculada a otro empleado de este negocio");
  });

  it("body con campos desconocidos o sin password -> 422", async () => {
    const { token } = await invitar();
    expect((await api().post(`/invitaciones/${token}/aceptar`).send({})).status).toBe(422);
    expect((await api().post(`/invitaciones/${token}/aceptar`).send({ password: "NuevaClave1", email: "otro@x.co" })).status).toBe(422);
  });
});
