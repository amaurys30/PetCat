import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { runSqlFile } from "../../scripts/lib/sqlRunner.js";
import { FORMATO_PASAPORTE, objetosEsperados, verificarBase } from "../../scripts/lib/verificarBase.js";

const MIGRACION_030 = fileURLToPath(new URL("../../../database/migrations/030_codigo_pasaporte.sql", import.meta.url));

const conConexion = async (fn) => {
  const conn = await pool.getConnection();
  try {
    return await fn(conn);
  } finally {
    conn.release();
  }
};

const contarMascotas = async () => Number((await pool.query("SELECT COUNT(*) AS n FROM mascotas"))[0][0].n);

describe("db:verificar (después de restaurar una copia)", () => {
  it("toma de petcat.sql la función del pasaporte, el procedimiento de recordatorios y los triggers", () => {
    const { FUNCTION, PROCEDURE, TRIGGER } = objetosEsperados();
    expect(FUNCTION).toEqual(["fn_codigo_pasaporte"]);
    expect(PROCEDURE).toContain("sp_programar_recordatorios_cita");
    expect(TRIGGER).toEqual(expect.arrayContaining(["trg_mascotas_before_insert", "trg_citas_after_update"]));
  });

  it("con la base completa: sin problemas, crea una mascota de prueba y no deja nada", async () => {
    const antes = await contarMascotas();
    const resultado = await conConexion(verificarBase);
    expect(resultado.problemas).toEqual([]);
    expect(resultado.codigoDePrueba).toMatch(FORMATO_PASAPORTE);
    expect(await contarMascotas()).toBe(antes);
  });

  it("como una copia sin --routines (sin la función): lo detecta y avisa que no se pueden crear mascotas", async () => {
    await pool.query("DROP FUNCTION fn_codigo_pasaporte");
    try {
      const { problemas } = await conConexion(verificarBase);
      expect(problemas).toEqual([
        "Falta la función fn_codigo_pasaporte",
        // El texto de MySQL varía ("FUNCTION … does not exist" o "codigo_pasaporte cannot be null").
        expect.stringMatching(/^No se pudo crear una mascota de prueba: /),
      ]);
    } finally {
      // La migración 030 es reejecutable: vuelve a crear la función.
      await conConexion((conn) => runSqlFile(conn, MIGRACION_030));
    }
    expect((await conConexion(verificarBase)).problemas).toEqual([]);
  });
});
