import { beforeEach, describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hashToken } from "../../src/shared/utils/hash.js";
import { outbox, clearOutbox } from "../../src/shared/utils/mailer.js";
import { MAX_INTENTOS_LOGIN } from "../../src/modules/auth/auth.service.js";
import { api } from "../helpers/api.js";
import { crearUsuario, tokenDe, PASSWORD } from "../helpers/factories.js";

const NUEVA = "OtraClave987";

const login = (email, password = PASSWORD) => api().post("/auth/login").send({ email, password });

const usuarioDe = async (id_usuario) => {
  const [[row]] = await pool.query("SELECT * FROM usuarios WHERE id_usuario = ?", [id_usuario]);
  return row;
};

const sesionesActivas = async (id_usuario) => {
  const [rows] = await pool.query("SELECT id_sesion FROM sesiones WHERE id_usuario = ? AND activa = TRUE", [id_usuario]);
  return rows.length;
};

const bloquear = (id_usuario) =>
  pool.query(
    "UPDATE usuarios SET intentos_login = ?, bloqueado_hasta = NOW() + INTERVAL 15 MINUTE WHERE id_usuario = ?",
    [MAX_INTENTOS_LOGIN, id_usuario]
  );

const tokenDelCorreo = (mail) => /\/restablecer-password\/([0-9a-f]{64})/.exec(mail.text)?.[1];

// Simula que el último enlace se pidió hace más de un minuto (se puede pedir otro).
const envejecerEnlace = (id_usuario) =>
  pool.query(
    "UPDATE usuarios SET token_recuperacion_expira = token_recuperacion_expira - INTERVAL 2 MINUTE WHERE id_usuario = ?",
    [id_usuario]
  );

const pedirEnlace = async (usuario) => {
  const res = await api().post("/auth/forgot-password").send({ email: usuario.email });
  expect(res.status).toBe(200);
  return tokenDelCorreo(outbox.at(-1));
};

beforeEach(() => clearOutbox());

describe("POST /auth/change-password", () => {
  it("cambia la contraseña y cierra las demás sesiones, no la actual", async () => {
    const usuario = await crearUsuario();
    const token = await tokenDe(usuario);
    const otro = await tokenDe(usuario);

    const res = await api(token)
      .post("/auth/change-password")
      .send({ password_actual: PASSWORD, password_nueva: NUEVA });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: "Contraseña actualizada. Se cerraron las demás sesiones",
      data: null,
    });
    expect((await api(token).get("/auth/me")).status).toBe(200);
    expect((await api(otro).get("/auth/me")).status).toBe(401);
    expect(await sesionesActivas(usuario.id_usuario)).toBe(1);
    expect((await login(usuario.email, PASSWORD)).status).toBe(401);
    expect((await login(usuario.email, NUEVA)).status).toBe(200);
  });

  it("contraseña actual incorrecta -> 422 y cuenta como intento fallido", async () => {
    const usuario = await crearUsuario();
    const res = await api(await tokenDe(usuario))
      .post("/auth/change-password")
      .send({ password_actual: "Incorrecta1", password_nueva: NUEVA });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      success: false,
      message: "La contraseña actual no es correcta",
      errors: { password_actual: "Contraseña incorrecta" },
    });
    expect((await usuarioDe(usuario.id_usuario)).intentos_login).toBe(1);
  });

  it("con la cuenta bloqueada no evalúa la contraseña -> 403", async () => {
    const usuario = await crearUsuario();
    const token = await tokenDe(usuario);
    await bloquear(usuario.id_usuario);
    const res = await api(token).post("/auth/change-password").send({ password_actual: PASSWORD, password_nueva: NUEVA });
    expect(res.status).toBe(403);
  });

  it("la nueva debe ser distinta de la actual y cumplir las reglas -> 422", async () => {
    const token = await tokenDe(await crearUsuario());
    const igual = await api(token).post("/auth/change-password").send({ password_actual: PASSWORD, password_nueva: PASSWORD });
    expect(igual.status).toBe(422);
    expect(igual.body.errors).toEqual({ password_nueva: "Debe ser distinta de la actual" });

    const debil = await api(token).post("/auth/change-password").send({ password_actual: PASSWORD, password_nueva: "corta" });
    expect(debil.status).toBe(422);
    expect(debil.body.errors).toHaveProperty("password_nueva");
  });

  it("sin token -> 401", async () => {
    const res = await api().post("/auth/change-password").send({ password_actual: PASSWORD, password_nueva: NUEVA });
    expect(res.status).toBe(401);
  });
});

describe("POST /auth/forgot-password", () => {
  const MENSAJE = "Si el correo está registrado, te enviamos un enlace para restablecer la contraseña";

  it("envía el enlace y guarda solo el hash del token, vigente 1 hora", async () => {
    const usuario = await crearUsuario();
    const res = await api().post("/auth/forgot-password").send({ email: usuario.email.toUpperCase() });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: MENSAJE, data: null });
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe(usuario.email);
    const token = tokenDelCorreo(outbox[0]);
    expect(outbox[0].text).toContain(`http://localhost:5173/restablecer-password/${token}`);

    const [[row]] = await pool.query(
      `SELECT token_recuperacion,
              TIMESTAMPDIFF(MINUTE, NOW(), token_recuperacion_expira) AS minutos
       FROM usuarios WHERE id_usuario = ?`,
      [usuario.id_usuario]
    );
    expect(row.token_recuperacion).toBe(hashToken(token));
    expect(row.minutos).toBeGreaterThanOrEqual(59);
    expect(row.minutos).toBeLessThanOrEqual(60);
  });

  it("email inexistente o cuenta desactivada: misma respuesta y ningún correo", async () => {
    const inactivo = await crearUsuario({ activo: false });
    for (const email of ["nadie_registrado@petcat.test", inactivo.email]) {
      const res = await api().post("/auth/forgot-password").send({ email });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe(MENSAJE);
    }
    expect(outbox).toHaveLength(0);
  });

  it("funciona con la cuenta bloqueada por intentos fallidos", async () => {
    const usuario = await crearUsuario();
    await bloquear(usuario.id_usuario);
    await pedirEnlace(usuario);
    expect(outbox).toHaveLength(1);
  });

  it("máximo un correo por minuto por cuenta; pasado el minuto, el nuevo enlace invalida el anterior", async () => {
    const usuario = await crearUsuario();
    const primero = await pedirEnlace(usuario);
    await api().post("/auth/forgot-password").send({ email: usuario.email });
    expect(outbox).toHaveLength(1);

    await envejecerEnlace(usuario.id_usuario);
    const segundo = await pedirEnlace(usuario);
    expect(outbox).toHaveLength(2);
    expect(segundo).not.toBe(primero);

    const viejo = await api().post("/auth/reset-password").send({ token: primero, password: NUEVA });
    expect(viejo.status).toBe(400);
  });

  it("email inválido -> 422", async () => {
    const res = await api().post("/auth/forgot-password").send({ email: "no-es-email" });
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({ email: "Correo electrónico inválido" });
  });
});

describe("POST /auth/reset-password", () => {
  it("restablece la contraseña de una cuenta bloqueada: desbloquea, verifica el email y cierra las sesiones", async () => {
    const usuario = await crearUsuario();
    const sesion = await tokenDe(usuario);
    await bloquear(usuario.id_usuario);
    const token = await pedirEnlace(usuario);

    const res = await api().post("/auth/reset-password").send({ token, password: NUEVA });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: "Contraseña restablecida. Ya puedes iniciar sesión", data: null });
    const guardado = await usuarioDe(usuario.id_usuario);
    expect(guardado).toMatchObject({
      intentos_login: 0,
      bloqueado_hasta: null,
      email_verificado: 1,
      token_recuperacion: null,
      token_recuperacion_expira: null,
    });
    expect(await sesionesActivas(usuario.id_usuario)).toBe(0);
    expect((await api(sesion).get("/auth/me")).status).toBe(401);
    expect((await login(usuario.email, NUEVA)).status).toBe(200);
  });

  it("el enlace sirve una sola vez -> 400 al reutilizarlo", async () => {
    const usuario = await crearUsuario();
    const token = await pedirEnlace(usuario);
    expect((await api().post("/auth/reset-password").send({ token, password: NUEVA })).status).toBe(200);

    const res = await api().post("/auth/reset-password").send({ token, password: "Tercera123" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("El enlace para restablecer la contraseña no es válido o ya venció. Solicita uno nuevo");
  });

  it("enlace vencido -> 400", async () => {
    const usuario = await crearUsuario();
    const token = await pedirEnlace(usuario);
    await pool.query("UPDATE usuarios SET token_recuperacion_expira = NOW() - INTERVAL 1 SECOND WHERE id_usuario = ?", [
      usuario.id_usuario,
    ]);
    expect((await api().post("/auth/reset-password").send({ token, password: NUEVA })).status).toBe(400);
  });

  it("cuenta desactivada después de pedir el enlace -> 403", async () => {
    const usuario = await crearUsuario();
    const token = await pedirEnlace(usuario);
    await pool.query("UPDATE usuarios SET activo = FALSE WHERE id_usuario = ?", [usuario.id_usuario]);
    const res = await api().post("/auth/reset-password").send({ token, password: NUEVA });
    expect(res.status).toBe(403);
  });

  it("token con formato inválido o contraseña débil -> 422", async () => {
    const res = await api().post("/auth/reset-password").send({ token: "abc", password: "corta" });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.errors).sort()).toEqual(["password", "token"]);
  });
});
