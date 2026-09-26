import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { comparePassword, hashToken } from "../../src/shared/utils/hash.js";
import { MAX_INTENTOS_LOGIN } from "../../src/modules/auth/auth.service.js";
import { api } from "../helpers/api.js";
import { crearUsuario, unique, PASSWORD } from "../helpers/factories.js";

const usuarioPorEmail = async (email) => {
  const [[row]] = await pool.query("SELECT * FROM usuarios WHERE email = ?", [email]);
  return row;
};

const login = (email, password = PASSWORD, extra = {}) =>
  api().post("/auth/login").send({ email, password, ...extra });

const datosRegistro = (overrides = {}) => ({
  nombre: "Ana",
  apellido: "Ruiz",
  email: `registro_${unique()}@petcat.test`,
  password: "Clave1234",
  ...overrides,
});

describe("POST /auth/register", () => {
  it("crea la cuenta y devuelve el usuario sin datos sensibles", async () => {
    const datos = datosRegistro({ telefono: "300 123 4567" });
    const res = await api().post("/auth/register").send(datos);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, message: "Cuenta creada. Te enviamos un correo para confirmar tu email" });
    expect(res.body.data).toEqual({
      id_usuario: expect.any(Number),
      nombre: "Ana",
      apellido: "Ruiz",
      email: datos.email,
      telefono: "300 123 4567",
      foto_url: null,
      tipo_usuario: "cliente",
      email_verificado: false,
    });

    const guardado = await usuarioPorEmail(datos.email);
    expect(guardado.password_hash).not.toBe(datos.password);
    expect(await comparePassword(datos.password, guardado.password_hash)).toBe(true);
  });

  it("normaliza el email (espacios y mayúsculas) y acepta tipo 'negocio'", async () => {
    const email = `Mayus_${unique()}@PetCat.Test`;
    const res = await api()
      .post("/auth/register")
      .send(datosRegistro({ email: `  ${email} `, tipo_usuario: "negocio" }));
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe(email.toLowerCase());
    expect(res.body.data.tipo_usuario).toBe("negocio");
  });

  it("no permite registrarse como admin -> 422", async () => {
    const res = await api().post("/auth/register").send(datosRegistro({ tipo_usuario: "admin" }));
    expect(res.status).toBe(422);
    expect(res.body.errors).toHaveProperty("tipo_usuario");
  });

  it("rechaza campos no permitidos (password_hash, activo...) -> 422", async () => {
    const res = await api()
      .post("/auth/register")
      .send(datosRegistro({ password_hash: "x", email_verificado: true }));
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({ password_hash: "Campo no permitido", email_verificado: "Campo no permitido" });
  });

  it("valida cada campo -> 422 con errores por campo", async () => {
    const res = await api()
      .post("/auth/register")
      .send({ nombre: "A", email: "no-es-email", password: "corta", telefono: "abc" });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.errors).sort()).toEqual(["apellido", "email", "nombre", "password", "telefono"]);
    expect(res.body.errors.apellido).toBe("Campo obligatorio");
    expect(res.body.errors.email).toBe("Correo electrónico inválido");
  });

  it("exige letra y número en la contraseña", async () => {
    const sinNumero = await api().post("/auth/register").send(datosRegistro({ password: "SoloLetras" }));
    expect(sinNumero.status).toBe(422);
    expect(sinNumero.body.errors.password).toBe("Debe incluir al menos un número");

    const sinLetra = await api().post("/auth/register").send(datosRegistro({ password: "12345678" }));
    expect(sinLetra.body.errors.password).toBe("Debe incluir al menos una letra");
  });

  it("email ya registrado (sin importar mayúsculas) -> 409", async () => {
    const existente = await crearUsuario();
    const res = await api()
      .post("/auth/register")
      .send(datosRegistro({ email: existente.email.toUpperCase() }));
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, errors: { email: "Ya está registrado" } });
  });
});

describe("POST /auth/login", () => {
  it("devuelve { access_token, refresh_token, usuario } y registra la sesión", async () => {
    const usuario = await crearUsuario();
    const res = await login(usuario.email, PASSWORD, { dispositivo: "android" }).set("User-Agent", "PetCatApp/1.0");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Sesión iniciada");
    expect(Object.keys(res.body.data).sort()).toEqual(["access_token", "refresh_token", "usuario"]);
    expect(res.body.data.usuario).toMatchObject({ id_usuario: usuario.id_usuario, email: usuario.email });
    expect(res.body.data.usuario).not.toHaveProperty("password_hash");

    const [[sesion]] = await pool.query("SELECT * FROM sesiones WHERE token = ?", [
      hashToken(res.body.data.access_token),
    ]);
    expect(sesion).toMatchObject({
      id_usuario: usuario.id_usuario,
      refresh_token: hashToken(res.body.data.refresh_token),
      dispositivo: "android",
      user_agent: "PetCatApp/1.0",
      activa: 1,
    });
    expect(sesion.ip_address).toMatch(/127\.0\.0\.1|::1/);

    expect((await usuarioPorEmail(usuario.email)).ultimo_acceso).not.toBeNull();

    // El token sirve en las rutas protegidas.
    expect((await api(res.body.data.access_token).post("/auth/logout")).status).toBe(200);
  });

  it("acepta el email con mayúsculas y espacios", async () => {
    const usuario = await crearUsuario();
    const res = await login(` ${usuario.email.toUpperCase()} `);
    expect(res.status).toBe(200);
  });

  it("los usuarios del seed inician sesión con la contraseña documentada", async () => {
    const res = await login("propietario@petcat.test", "Petcat123!");
    expect(res.status).toBe(200);
  });

  it("email inexistente y contraseña errónea dan la misma respuesta 401", async () => {
    const usuario = await crearUsuario();
    const inexistente = await login(`nadie_${unique()}@petcat.test`);
    const erronea = await login(usuario.email, "Incorrecta1");

    expect(inexistente.status).toBe(401);
    expect(erronea.status).toBe(401);
    expect(inexistente.body).toEqual({ success: false, message: "Credenciales inválidas" });
    expect(erronea.body).toEqual(inexistente.body);
  });

  it("cuenta desactivada con la contraseña correcta -> 403", async () => {
    const usuario = await crearUsuario({ activo: false });
    const res = await login(usuario.email);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("La cuenta está desactivada");
  });

  it("datos inválidos -> 422", async () => {
    const res = await api().post("/auth/login").send({ email: "x" });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.errors).sort()).toEqual(["email", "password"]);
  });

  it(`bloquea la cuenta 15 minutos al ${MAX_INTENTOS_LOGIN}.º intento fallido seguido`, async () => {
    const usuario = await crearUsuario();

    for (let i = 1; i < MAX_INTENTOS_LOGIN; i++) {
      expect((await login(usuario.email, "Incorrecta1")).status, `intento ${i}`).toBe(401);
    }
    const quinto = await login(usuario.email, "Incorrecta1");
    expect(quinto.status).toBe(403);
    expect(quinto.body.message).toMatch(/bloqueada/);

    // Bloqueada: ni la contraseña correcta entra.
    const correcta = await login(usuario.email);
    expect(correcta.status).toBe(403);

    const [[fila]] = await pool.query(
      "SELECT intentos_login, TIMESTAMPDIFF(SECOND, NOW(), bloqueado_hasta) AS segundos FROM usuarios WHERE id_usuario = ?",
      [usuario.id_usuario]
    );
    expect(fila.intentos_login).toBe(MAX_INTENTOS_LOGIN);
    expect(fila.segundos).toBeGreaterThan(14 * 60);
    expect(fila.segundos).toBeLessThanOrEqual(15 * 60);
  });

  it("un login correcto reinicia el contador de intentos", async () => {
    const usuario = await crearUsuario();
    for (let i = 1; i < MAX_INTENTOS_LOGIN; i++) await login(usuario.email, "Incorrecta1");

    expect((await login(usuario.email)).status).toBe(200);
    const fila = await usuarioPorEmail(usuario.email);
    expect(fila.intentos_login).toBe(0);
    expect(fila.bloqueado_hasta).toBeNull();

    // Vuelve a tener todos los intentos.
    for (let i = 1; i < MAX_INTENTOS_LOGIN; i++) {
      expect((await login(usuario.email, "Incorrecta1")).status).toBe(401);
    }
  });

  it("al vencer el bloqueo se puede entrar y el conteo empieza de nuevo", async () => {
    const vencido = "NOW() - INTERVAL 1 MINUTE";
    const a = await crearUsuario();
    const b = await crearUsuario();
    await pool.query(
      `UPDATE usuarios SET intentos_login = ?, bloqueado_hasta = ${vencido} WHERE id_usuario IN (?, ?)`,
      [MAX_INTENTOS_LOGIN, a.id_usuario, b.id_usuario]
    );

    // a: entra con la contraseña correcta.
    expect((await login(a.email)).status).toBe(200);

    // b: un nuevo fallo cuenta como el primero, sin volver a bloquear.
    expect((await login(b.email, "Incorrecta1")).status).toBe(401);
    const fila = await usuarioPorEmail(b.email);
    expect(fila.intentos_login).toBe(1);
    expect(fila.bloqueado_hasta).toBeNull();
  });
});
