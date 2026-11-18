import { beforeEach, describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { outbox, clearOutbox, textoParaConsola } from "../../src/shared/utils/mailer.js";
import { MAX_INTENTOS_LOGIN, emitirEnlaceBienvenida } from "../../src/modules/auth/auth.service.js";
import { CODIGOS_POR_HORA, MAX_INTENTOS_CODIGO } from "../../src/modules/auth/codigo.service.js";
import { withTransaction } from "../../src/shared/utils/transaction.js";
import { api } from "../helpers/api.js";
import { crearUsuario, tokenDe, unique, PASSWORD } from "../helpers/factories.js";

const NUEVA = "OtraClave987";
const CODIGO_INVALIDO = "El código no es válido o ya venció. Solicita uno nuevo";

const codigoDelCorreo = (mail) => /escribe este código: (\d{6})/.exec(mail.text)?.[1];
const enlaceVerificacion = (mail) => /\/verificar-email\/([0-9a-f]{64})/.exec(mail.text)?.[1];
const enlaceRecuperacion = (mail) => /\/restablecer-password\/([0-9a-f]{64})/.exec(mail.text)?.[1];

/** Un código de 6 dígitos distinto del correcto. */
const otroCodigo = (codigo) => String((Number(codigo) + 1) % 1_000_000).padStart(6, "0");

const usuarioDe = async (id_usuario) => {
  const [[row]] = await pool.query("SELECT * FROM usuarios WHERE id_usuario = ?", [id_usuario]);
  return row;
};

const codigosDe = async (id_usuario, tipo) => {
  const [rows] = await pool.query(
    "SELECT * FROM codigos_correo WHERE id_usuario = ? AND tipo = ? ORDER BY id_codigo",
    [id_usuario, tipo]
  );
  return rows;
};

const sesionesActivas = async (id_usuario) => {
  const [rows] = await pool.query("SELECT id_sesion FROM sesiones WHERE id_usuario = ? AND activa = TRUE", [id_usuario]);
  return rows.length;
};

// Simula que los correos de la cuenta se pidieron hace `minutos` (enlaces y códigos).
const envejecer = async (id_usuario, minutos = 2) => {
  await pool.query(
    `UPDATE usuarios
     SET token_verificacion_expira = token_verificacion_expira - INTERVAL ? MINUTE,
         token_recuperacion_expira = token_recuperacion_expira - INTERVAL ? MINUTE
     WHERE id_usuario = ?`,
    [minutos, minutos, id_usuario]
  );
  await pool.query(
    "UPDATE codigos_correo SET fecha_creacion = fecha_creacion - INTERVAL ? MINUTE WHERE id_usuario = ?",
    [minutos, id_usuario]
  );
};

const registrar = async () => {
  const email = `codigo_${unique()}@petcat.test`;
  const res = await api()
    .post("/auth/register")
    .send({ nombre: "Ana", apellido: "Ruiz", email, password: PASSWORD, acepta_politica_datos: true });
  expect(res.status).toBe(201);
  const correo = outbox.at(-1);
  const usuario = await usuarioDe(res.body.data.id_usuario);
  return { usuario, codigo: codigoDelCorreo(correo), enlace: enlaceVerificacion(correo), sesion: await tokenDe(usuario) };
};

const pedirRecuperacion = async (email) => {
  const res = await api().post("/auth/forgot-password").send({ email });
  expect(res.status).toBe(200);
};

const restablecer = (email, codigo, password = NUEVA) =>
  api().post("/auth/reset-password/codigo").send({ email, codigo, password });

beforeEach(() => clearOutbox());

describe("código de 6 dígitos en los correos", () => {
  it("el registro envía código y enlace; la base guarda el HMAC, vigente 15 minutos", async () => {
    const { usuario, codigo, enlace } = await registrar();

    expect(codigo).toMatch(/^\d{6}$/);
    expect(enlace).toMatch(/^[0-9a-f]{64}$/);
    expect(outbox.at(-1).html).toContain(codigo);

    const [fila] = await codigosDe(usuario.id_usuario, "verificacion");
    expect(fila.codigo_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(fila.codigo_hash).not.toContain(codigo);
    expect(fila).toMatchObject({ intentos: 0, cerrado_en: null });
    const [[{ minutos }]] = await pool.query(
      "SELECT TIMESTAMPDIFF(MINUTE, NOW(), expira) AS minutos FROM codigos_correo WHERE id_codigo = ?",
      [fila.id_codigo]
    );
    expect(minutos).toBeGreaterThanOrEqual(14);
    expect(minutos).toBeLessThanOrEqual(15);
  });

  it("el modo consola del mailer tapa el código: nunca va a un log", () => {
    const texto = "Escribe este código: 482913 (vence en 15 minutos).";
    const consola = textoParaConsola(texto, ["482913"]);
    expect(consola).not.toContain("482913");
    expect(consola).toContain("••••••");
    expect(textoParaConsola("sin secretos")).toBe("sin secretos");
  });
});

describe("POST /auth/verify-email/codigo", () => {
  const verificar = (sesion, codigo) => api(sesion).post("/auth/verify-email/codigo").send({ codigo });

  it("verifica el correo, cierra el código e invalida el enlace del mismo correo", async () => {
    const { usuario, codigo, enlace, sesion } = await registrar();

    const res = await verificar(sesion, codigo);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: "Correo verificado", data: null });
    expect(await usuarioDe(usuario.id_usuario)).toMatchObject({ email_verificado: 1, token_verificacion: null });
    expect((await codigosDe(usuario.id_usuario, "verificacion"))[0].motivo_cierre).toBe("usado");
    expect((await api().get(`/auth/verify-email/${enlace}`)).status).toBe(400);
  });

  it("usar el enlace cierra el código", async () => {
    const { usuario, enlace } = await registrar();
    expect((await api().get(`/auth/verify-email/${enlace}`)).status).toBe(200);
    expect((await codigosDe(usuario.id_usuario, "verificacion"))[0].motivo_cierre).toBe("enlace");
  });

  it("código incorrecto -> 400 y el intento queda contado; al quinto se anula", async () => {
    const { usuario, codigo, sesion } = await registrar();

    const malo = await verificar(sesion, otroCodigo(codigo));
    expect(malo.status).toBe(400);
    expect(malo.body.message).toBe(CODIGO_INVALIDO);
    expect((await codigosDe(usuario.id_usuario, "verificacion"))[0].intentos).toBe(1);

    for (let i = 1; i < MAX_INTENTOS_CODIGO; i++) {
      expect((await verificar(sesion, otroCodigo(codigo))).status).toBe(400);
    }
    const [fila] = await codigosDe(usuario.id_usuario, "verificacion");
    expect(fila).toMatchObject({ intentos: MAX_INTENTOS_CODIGO, motivo_cierre: "intentos" });

    // Anulado: ni el código correcto sirve ya.
    expect((await verificar(sesion, codigo)).status).toBe(400);
    expect((await usuarioDe(usuario.id_usuario)).email_verificado).toBe(0);
  });

  it("un correo nuevo reemplaza el código anterior", async () => {
    const { usuario, codigo, sesion } = await registrar();
    await envejecer(usuario.id_usuario);
    expect((await api(sesion).post("/auth/resend-verification")).status).toBe(200);
    const nuevo = codigoDelCorreo(outbox.at(-1));

    if (nuevo !== codigo) expect((await verificar(sesion, codigo)).status).toBe(400);
    expect((await codigosDe(usuario.id_usuario, "verificacion"))[0].motivo_cierre).toBe("reemplazado");
    expect((await verificar(sesion, nuevo)).status).toBe(200);
  });

  it("código vencido -> 400", async () => {
    const { usuario, codigo, sesion } = await registrar();
    await pool.query("UPDATE codigos_correo SET expira = NOW() - INTERVAL 1 SECOND WHERE id_usuario = ?", [
      usuario.id_usuario,
    ]);
    expect((await verificar(sesion, codigo)).status).toBe(400);
  });

  it("correo ya verificado -> 409; sin sesión -> 401; formato inválido -> 422", async () => {
    const verificado = await crearUsuario({ email_verificado: true });
    const ya = await verificar(await tokenDe(verificado), "123456");
    expect(ya.status).toBe(409);
    expect(ya.body.message).toBe("Tu correo ya está verificado");

    expect((await api().post("/auth/verify-email/codigo").send({ codigo: "123456" })).status).toBe(401);

    const { sesion } = await registrar();
    for (const codigo of ["12345", "1234567", "abcdef", 123456]) {
      const res = await verificar(sesion, codigo);
      expect(res.status).toBe(422);
      expect(res.body.errors).toHaveProperty("codigo");
    }
  });
});

describe("POST /auth/reset-password/codigo", () => {
  it("cambia la contraseña: desbloquea, verifica el email, invalida el enlace y cierra todas las sesiones", async () => {
    const usuario = await crearUsuario();
    const sesion = await tokenDe(usuario);
    await pool.query("UPDATE usuarios SET intentos_login = ?, bloqueado_hasta = NOW() + INTERVAL 15 MINUTE WHERE id_usuario = ?", [
      MAX_INTENTOS_LOGIN,
      usuario.id_usuario,
    ]);
    await pedirRecuperacion(usuario.email);
    const correo = outbox.at(-1);

    const res = await restablecer(usuario.email.toUpperCase(), codigoDelCorreo(correo));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: "Contraseña restablecida. Ya puedes iniciar sesión", data: null });
    expect(await usuarioDe(usuario.id_usuario)).toMatchObject({
      intentos_login: 0,
      bloqueado_hasta: null,
      email_verificado: 1,
      token_recuperacion: null,
    });
    expect(await sesionesActivas(usuario.id_usuario)).toBe(0);
    expect((await api(sesion).get("/auth/me")).status).toBe(401);
    expect((await api().post("/auth/login").send({ email: usuario.email, password: NUEVA })).status).toBe(200);
    // El enlace del mismo correo ya no sirve.
    const enlace = await api().post("/auth/reset-password").send({ token: enlaceRecuperacion(correo), password: "Tercera123" });
    expect(enlace.status).toBe(400);
  });

  it("misma respuesta si el email no existe, la cuenta está desactivada o el código no coincide", async () => {
    const usuario = await crearUsuario();
    const inactivo = await crearUsuario();
    await pedirRecuperacion(usuario.email);
    const codigo = codigoDelCorreo(outbox.at(-1));
    await pedirRecuperacion(inactivo.email);
    const codigoInactivo = codigoDelCorreo(outbox.at(-1));
    await pool.query("UPDATE usuarios SET activo = FALSE WHERE id_usuario = ?", [inactivo.id_usuario]);

    const respuestas = [
      await restablecer(`nadie_${unique()}@petcat.test`, codigo),
      await restablecer(inactivo.email, codigoInactivo),
      await restablecer(usuario.email, otroCodigo(codigo)),
    ];
    for (const res of respuestas) {
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: CODIGO_INVALIDO });
    }
  });

  it("el código sirve una vez; usar el enlace también lo anula", async () => {
    const uno = await crearUsuario();
    await pedirRecuperacion(uno.email);
    const codigo = codigoDelCorreo(outbox.at(-1));
    expect((await restablecer(uno.email, codigo)).status).toBe(200);
    expect((await restablecer(uno.email, codigo, "Tercera123")).status).toBe(400);

    const dos = await crearUsuario();
    await pedirRecuperacion(dos.email);
    const correo = outbox.at(-1);
    expect((await api().post("/auth/reset-password").send({ token: enlaceRecuperacion(correo), password: NUEVA })).status).toBe(200);
    expect((await restablecer(dos.email, codigoDelCorreo(correo), "Tercera123")).status).toBe(400);
    expect((await codigosDe(dos.id_usuario, "recuperacion"))[0].motivo_cierre).toBe("enlace");
  });

  it("5 intentos fallidos anulan el código; un código vencido no sirve", async () => {
    const usuario = await crearUsuario();
    await pedirRecuperacion(usuario.email);
    const codigo = codigoDelCorreo(outbox.at(-1));
    for (let i = 0; i < MAX_INTENTOS_CODIGO; i++) {
      expect((await restablecer(usuario.email, otroCodigo(codigo))).status).toBe(400);
    }
    expect((await restablecer(usuario.email, codigo)).status).toBe(400);
    expect((await codigosDe(usuario.id_usuario, "recuperacion"))[0].motivo_cierre).toBe("intentos");

    const otro = await crearUsuario();
    await pedirRecuperacion(otro.email);
    const vencido = codigoDelCorreo(outbox.at(-1));
    await pool.query("UPDATE codigos_correo SET expira = NOW() - INTERVAL 1 SECOND WHERE id_usuario = ?", [otro.id_usuario]);
    expect((await restablecer(otro.email, vencido)).status).toBe(400);
  });

  it("formato inválido -> 422", async () => {
    const res = await api().post("/auth/reset-password/codigo").send({ email: "no-es-email", codigo: "12", password: "corta" });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.errors).sort()).toEqual(["codigo", "email", "password"]);
  });
});

describe("límite de correos por cuenta (además del de IP)", () => {
  it(`forgot-password: uno por minuto y ${CODIGOS_POR_HORA} por hora, con la misma respuesta`, async () => {
    const usuario = await crearUsuario();
    await pedirRecuperacion(usuario.email);
    await pedirRecuperacion(usuario.email);
    expect(outbox).toHaveLength(1);

    for (let i = 1; i < CODIGOS_POR_HORA; i++) {
      await envejecer(usuario.id_usuario, 2);
      await pedirRecuperacion(usuario.email);
    }
    expect(outbox).toHaveLength(CODIGOS_POR_HORA);

    await envejecer(usuario.id_usuario, 2);
    await pedirRecuperacion(usuario.email);
    expect(outbox).toHaveLength(CODIGOS_POR_HORA);

    // Pasada la hora del primero, se puede pedir otro.
    await envejecer(usuario.id_usuario, 60);
    await pedirRecuperacion(usuario.email);
    expect(outbox).toHaveLength(CODIGOS_POR_HORA + 1);
  });

  it(`resend-verification: 429 al pasar de ${CODIGOS_POR_HORA} por hora`, async () => {
    const { usuario, sesion } = await registrar();
    for (let i = 1; i < CODIGOS_POR_HORA; i++) {
      await envejecer(usuario.id_usuario, 2);
      expect((await api(sesion).post("/auth/resend-verification")).status).toBe(200);
    }
    await envejecer(usuario.id_usuario, 2);
    const res = await api(sesion).post("/auth/resend-verification");
    expect(res.status).toBe(429);
    expect(res.body.message).toBe(`Ya te enviamos ${CODIGOS_POR_HORA} correos en la última hora. Intenta más tarde`);
  });

  it("un enlace de bienvenida pendiente (7 días) no impide pedir la recuperación", async () => {
    const usuario = await crearUsuario();
    const bienvenida = await withTransaction((conn) => emitirEnlaceBienvenida(usuario.id_usuario, conn));
    clearOutbox();

    await pedirRecuperacion(usuario.email);
    expect(outbox).toHaveLength(1);
    expect((await restablecer(usuario.email, codigoDelCorreo(outbox[0]))).status).toBe(200);
    // El enlace de bienvenida quedó reemplazado.
    expect((await api().post("/auth/reset-password").send({ token: bienvenida, password: "Tercera123" })).status).toBe(400);
  });
});
