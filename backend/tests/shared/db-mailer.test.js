import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { withTransaction } from "../../src/shared/utils/transaction.js";
import { spawnSync } from "node:child_process";
import {
  sendMail,
  outbox,
  clearOutbox,
  explicarErrorSmtp,
  modoSeguro,
  transportOptions,
} from "../../src/shared/utils/mailer.js";
import { env } from "../../src/config/env.js";

describe("withTransaction (petcat_test)", () => {
  beforeAll(async () => {
    await pool.query("CREATE TABLE IF NOT EXISTS _tx_prueba (id INT PRIMARY KEY)");
    await pool.query("DELETE FROM _tx_prueba");
  });

  afterAll(async () => {
    await pool.query("DROP TABLE IF EXISTS _tx_prueba");
  });

  it("hace commit y devuelve el resultado", async () => {
    const result = await withTransaction(async (conn) => {
      await conn.query("INSERT INTO _tx_prueba VALUES (1)");
      return "ok";
    });
    expect(result).toBe("ok");
    const [rows] = await pool.query("SELECT id FROM _tx_prueba");
    expect(rows.map((r) => r.id)).toEqual([1]);
  });

  it("hace rollback de todo si algo falla y propaga el error", async () => {
    await expect(
      withTransaction(async (conn) => {
        await conn.query("INSERT INTO _tx_prueba VALUES (2)");
        await conn.query("INSERT INTO _tx_prueba VALUES (1)"); // duplicado
      })
    ).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });

    const [rows] = await pool.query("SELECT id FROM _tx_prueba ORDER BY id");
    expect(rows.map((r) => r.id)).toEqual([1]);
  });

  it("libera la conexión en ambos casos", () => {
    const { _allConnections, _freeConnections } = pool.pool;
    expect(_freeConnections.length).toBe(_allConnections.length);
  });
});

describe("mailer en tests", () => {
  it("guarda el correo en outbox sin enviarlo", async () => {
    clearOutbox();
    const result = await sendMail({
      to: "ana@petcat.co",
      subject: "Invitación",
      text: "http://localhost:5173/invitacion/abc",
    });
    expect(result).toEqual({ delivered: false, mode: "test" });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: "ana@petcat.co", from: expect.stringContaining("PetCat") });
  });
});

const smtp = (cambios = {}) => ({ SMTP_HOST: "smtp.ejemplo.com", SMTP_PORT: 587, SMTP_TIMEOUT_MS: 10000, ...cambios });

describe("modos de cifrado y autenticación", () => {
  it("deduce el cifrado: 465 -> tls; con usuario -> starttls; sin usuario -> none (Mailpit)", () => {
    expect(modoSeguro(smtp({ SMTP_PORT: 465 }))).toBe("tls");
    expect(modoSeguro(smtp({ SMTP_USER: "a@b.co" }))).toBe("starttls");
    expect(modoSeguro(smtp({ SMTP_HOST: "mailpit", SMTP_PORT: 1025 }))).toBe("none");
    expect(modoSeguro(smtp({ SMTP_PORT: 465, SMTP_SECURE: "starttls" }))).toBe("starttls");
  });

  it("tls: TLS directo con autenticación", () => {
    expect(transportOptions(smtp({ SMTP_PORT: 465, SMTP_USER: "u", SMTP_PASS: "p" }))).toMatchObject({
      port: 465,
      secure: true,
      requireTLS: false,
      ignoreTLS: false,
      auth: { user: "u", pass: "p" },
    });
  });

  it("starttls: exige STARTTLS en el 587", () => {
    expect(transportOptions(smtp({ SMTP_USER: "u", SMTP_PASS: "p" }))).toMatchObject({
      secure: false,
      requireTLS: true,
      ignoreTLS: false,
    });
  });

  it("none: sin cifrar ni autenticación (Mailpit)", () => {
    const opciones = transportOptions(smtp({ SMTP_HOST: "mailpit", SMTP_PORT: 1025, SMTP_SECURE: "none" }));
    expect(opciones).toMatchObject({ host: "mailpit", port: 1025, secure: false, requireTLS: false, ignoreTLS: true });
    expect(opciones.auth).toBeUndefined();
  });

  it("SMTP_USER sin SMTP_PASS es una configuración inválida", () => {
    const resultado = spawnSync(process.execPath, ["--input-type=module", "-e", 'await import("./src/config/env.js")'], {
      env: { ...process.env, SMTP_USER: "solo@usuario.co", SMTP_PASS: "" },
      encoding: "utf8",
    });
    expect(resultado.status).not.toBe(0);
    expect(resultado.stderr).toContain("SMTP_USER y SMTP_PASS van juntas");
  });
});

describe("errores SMTP explicados", () => {
  const config = smtp({ SMTP_HOST: "smtp.gmail.com", SMTP_PORT: 587 });
  const casos = [
    [{ code: "EAUTH", message: "Invalid login: 535 5.7.8" }, /usuario o la contraseña.*contraseña de aplicación/],
    [{ code: "ESOCKET", message: "getaddrinfo ENOTFOUND smtp.gmial.com" }, /No se encontró el servidor/],
    [{ code: "ESOCKET", message: "connect ECONNREFUSED 127.0.0.1:1025" }, /Nadie respondió en smtp.gmail.com:587/],
    [{ code: "ETIMEDOUT", message: "Connection timeout" }, /no respondió en 10000 ms/],
    [{ code: "ESOCKET", message: "write EPROTO ...:wrong version number" }, /SMTP_SECURE=tls con 465/],
    [{ code: "EENVELOPE", message: "Sender address rejected" }, /rechazó el remitente/],
  ];
  it.each(casos)("%o", (error, esperado) => {
    expect(explicarErrorSmtp(error, config)).toMatch(esperado);
  });
});

describe("transporte SMTP", () => {
  it("usa SMTP_TIMEOUT_MS (10 s por defecto) para conexión, saludo e inactividad", () => {
    expect(env.SMTP_TIMEOUT_MS).toBe(10000);
    expect(transportOptions()).toMatchObject({
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
  });
});
