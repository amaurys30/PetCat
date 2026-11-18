import { beforeEach, describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { hashToken } from "../../src/shared/utils/hash.js";
import { outbox, clearOutbox } from "../../src/shared/utils/mailer.js";
import { api } from "../helpers/api.js";
import { crearUsuario, tokenDe, unique } from "../helpers/factories.js";

const tokenDelCorreo = (mail) => /\/verificar-email\/([0-9a-f]{64})/.exec(mail.text)?.[1];

const registrar = async () => {
  const email = `verifica_${unique()}@petcat.test`;
  const res = await api()
    .post("/auth/register")
    .send({ nombre: "Ana", apellido: "Ruiz", email, password: "Clave1234", acepta_politica_datos: true });
  expect(res.status).toBe(201);
  return { ...res.body.data, token: tokenDelCorreo(outbox.at(-1)) };
};

const usuarioDe = async (id_usuario) => {
  const [[row]] = await pool.query("SELECT * FROM usuarios WHERE id_usuario = ?", [id_usuario]);
  return row;
};

// Simula que el último correo de verificación (enlace y código) se envió hace más de un minuto.
const envejecerEnlace = async (id_usuario) => {
  await pool.query(
    "UPDATE usuarios SET token_verificacion_expira = token_verificacion_expira - INTERVAL 2 MINUTE WHERE id_usuario = ?",
    [id_usuario]
  );
  await pool.query(
    "UPDATE codigos_correo SET fecha_creacion = fecha_creacion - INTERVAL 2 MINUTE WHERE id_usuario = ?",
    [id_usuario]
  );
};

beforeEach(() => clearOutbox());

describe("verificación de email", () => {
  it("el registro envía el enlace, vigente 24 horas, y guarda solo el hash del token", async () => {
    const usuario = await registrar();

    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: usuario.email, subject: "Confirma tu correo en PetCat" });
    expect(outbox[0].text).toContain(`http://localhost:5173/verificar-email/${usuario.token}`);
    const [[row]] = await pool.query(
      `SELECT token_verificacion, TIMESTAMPDIFF(MINUTE, NOW(), token_verificacion_expira) AS minutos
       FROM usuarios WHERE id_usuario = ?`,
      [usuario.id_usuario]
    );
    expect(row.token_verificacion).toBe(hashToken(usuario.token));
    expect(row.minutos).toBeGreaterThanOrEqual(24 * 60 - 1);
  });

  it("GET /auth/verify-email/:token marca el email como verificado; el token sirve una vez", async () => {
    const usuario = await registrar();

    const res = await api().get(`/auth/verify-email/${usuario.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: "Correo verificado", data: null });
    expect(await usuarioDe(usuario.id_usuario)).toMatchObject({
      email_verificado: 1,
      token_verificacion: null,
      token_verificacion_expira: null,
    });

    const otraVez = await api().get(`/auth/verify-email/${usuario.token}`);
    expect(otraVez.status).toBe(400);
    expect(otraVez.body.message).toBe("El enlace de verificación no es válido o ya venció");
  });

  it("token vencido -> 400; formato inválido -> 422", async () => {
    const usuario = await registrar();
    await pool.query("UPDATE usuarios SET token_verificacion_expira = NOW() - INTERVAL 1 SECOND WHERE id_usuario = ?", [
      usuario.id_usuario,
    ]);
    expect((await api().get(`/auth/verify-email/${usuario.token}`)).status).toBe(400);
    expect((await api().get("/auth/verify-email/no-es-token")).status).toBe(422);
  });

  it("el email sin verificar no impide iniciar sesión", async () => {
    const usuario = await registrar();
    const res = await api().post("/auth/login").send({ email: usuario.email, password: "Clave1234" });
    expect(res.status).toBe(200);
    expect(res.body.data.usuario.email_verificado).toBe(false);
  });
});

describe("POST /auth/resend-verification", () => {
  it("antes de un minuto -> 429; después envía un enlace nuevo e invalida el anterior", async () => {
    const registrado = await registrar();
    const token = await tokenDe(await usuarioDe(registrado.id_usuario));

    const pronto = await api(token).post("/auth/resend-verification");
    expect(pronto.status).toBe(429);
    expect(outbox).toHaveLength(1);

    await envejecerEnlace(registrado.id_usuario);
    const res = await api(token).post("/auth/resend-verification");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: "Te enviamos un nuevo código y enlace de verificación",
      data: { email: registrado.email },
    });
    expect(outbox).toHaveLength(2);
    const nuevo = tokenDelCorreo(outbox[1]);
    expect(nuevo).not.toBe(registrado.token);

    expect((await api().get(`/auth/verify-email/${registrado.token}`)).status).toBe(400);
    expect((await api().get(`/auth/verify-email/${nuevo}`)).status).toBe(200);
  });

  it("correo ya verificado -> 409", async () => {
    const usuario = await crearUsuario({ email_verificado: true });
    const res = await api(await tokenDe(usuario)).post("/auth/resend-verification");
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Tu correo ya está verificado");
  });

  it("usuario sin token de verificación previo (creado antes de la Fase 1) recibe uno", async () => {
    const usuario = await crearUsuario();
    const res = await api(await tokenDe(usuario)).post("/auth/resend-verification");
    expect(res.status).toBe(200);
    expect(outbox).toHaveLength(1);
  });

  it("sin token -> 401", async () => {
    expect((await api().post("/auth/resend-verification")).status).toBe(401);
  });
});

describe("POST /auth/request-verification (sin sesión)", () => {
  const MENSAJE = "Si el correo está registrado y sin verificar, te enviamos un nuevo código y enlace de verificación";
  const pedir = (email) => api().post("/auth/request-verification").send({ email });

  it("envía un enlace nuevo que verifica el correo e invalida el anterior; máximo uno por minuto", async () => {
    const usuario = await registrar();
    await envejecerEnlace(usuario.id_usuario);
    clearOutbox();

    const res = await pedir(usuario.email.toUpperCase());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: MENSAJE, data: null });
    expect(outbox).toHaveLength(1);
    const nuevo = tokenDelCorreo(outbox[0]);
    expect(nuevo).not.toBe(usuario.token);

    // Antes de un minuto responde igual, pero no envía otro.
    expect((await pedir(usuario.email)).body.message).toBe(MENSAJE);
    expect(outbox).toHaveLength(1);

    expect((await api().get(`/auth/verify-email/${usuario.token}`)).status).toBe(400);
    expect((await api().get(`/auth/verify-email/${nuevo}`)).status).toBe(200);
    expect(Boolean((await usuarioDe(usuario.id_usuario)).email_verificado)).toBe(true);
  });

  it("respuesta neutra sin enviar nada: email inexistente, ya verificado o cuenta desactivada", async () => {
    const verificado = await crearUsuario({ email_verificado: true });
    const inactivo = await crearUsuario({ activo: false });

    for (const email of [`nadie_${unique()}@petcat.test`, verificado.email, inactivo.email]) {
      const res = await pedir(email);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe(MENSAJE);
    }
    expect(outbox).toEqual([]);
  });

  it("email inválido o campos extra -> 422", async () => {
    expect((await pedir("no-es-email")).status).toBe(422);
    const extra = await api().post("/auth/request-verification").send({ email: "a@petcat.test", id_usuario: 1 });
    expect(extra.status).toBe(422);
  });
});
