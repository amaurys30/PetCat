import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { withTransaction } from "../../src/shared/utils/transaction.js";
import { sendMail, outbox, clearOutbox, transportOptions } from "../../src/shared/utils/mailer.js";
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
