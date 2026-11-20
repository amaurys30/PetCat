import { fileURLToPath } from "node:url";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { runSqlFile } from "../../scripts/lib/sqlRunner.js";
import { crearMascota, crearUsuario } from "../helpers/factories.js";

// La base de los tests ya trae la 030 (petcat.sql). Cada prueba la deshace (todo o una parte,
// como si una corrida anterior hubiera fallado a mitad) y la vuelve a correr dos veces, igual
// que `npm run db:migrate`. Los archivos de tests corren uno a la vez (fileParallelism: false).
const MIGRACION = fileURLToPath(new URL("../../../database/migrations/030_codigo_pasaporte.sql", import.meta.url));
const FORMATO = /^PC-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/;

/** Código válido al azar, para no chocar con los de otras pruebas (la base es compartida). */
const codigoAlAzar = () => {
  const alfabeto = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
  const parte = () => Array.from({ length: 4 }, () => alfabeto[Math.floor(Math.random() * alfabeto.length)]).join("");
  return `PC-${parte()}-${parte()}`;
};

const correr = async () => {
  const conn = await pool.getConnection();
  try {
    await runSqlFile(conn, MIGRACION);
  } finally {
    conn.release();
  }
};

const existe = async (sql) => {
  const [[fila]] = await pool.query(sql);
  return Number(Object.values(fila)[0]) > 0;
};

/** Deja `mascotas` como antes de la 030 (sin columna, índice, trigger ni función). */
const deshacer = async () => {
  await pool.query("DROP TRIGGER IF EXISTS trg_mascotas_before_insert");
  await pool.query("DROP FUNCTION IF EXISTS fn_codigo_pasaporte");
  if (
    await existe(
      `SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'mascotas' AND INDEX_NAME = 'uq_mascotas_codigo_pasaporte'`
    )
  ) {
    await pool.query("ALTER TABLE mascotas DROP INDEX uq_mascotas_codigo_pasaporte");
  }
  if (
    await existe(
      `SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'mascotas' AND COLUMN_NAME = 'codigo_pasaporte'`
    )
  ) {
    await pool.query("ALTER TABLE mascotas DROP COLUMN codigo_pasaporte");
  }
};

const codigos = async () => {
  const [filas] = await pool.query("SELECT id_mascota, codigo_pasaporte FROM mascotas ORDER BY id_mascota");
  return new Map(filas.map((f) => [f.id_mascota, f.codigo_pasaporte]));
};

/** El estado final debe ser el de petcat.sql. */
const verificarEstadoFinal = async () => {
  const [[columna]] = await pool.query(
    `SELECT IS_NULLABLE, CHARACTER_SET_NAME, COLLATION_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mascotas' AND COLUMN_NAME = 'codigo_pasaporte'`
  );
  expect(columna).toEqual({ IS_NULLABLE: "NO", CHARACTER_SET_NAME: "ascii", COLLATION_NAME: "ascii_bin" });
  const [[indice]] = await pool.query(
    `SELECT NON_UNIQUE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'mascotas' AND INDEX_NAME = 'uq_mascotas_codigo_pasaporte'`
  );
  expect(Number(indice.NON_UNIQUE)).toBe(0);
  expect(
    await existe(
      `SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()
       AND TRIGGER_NAME = 'trg_mascotas_before_insert'`
    )
  ).toBe(true);
  expect(
    await existe(
      `SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE()
       AND ROUTINE_NAME LIKE 'tmp\\_030\\_%'`
    )
  ).toBe(false);

  const todos = [...(await codigos()).values()];
  for (const codigo of todos) expect(codigo).toMatch(FORMATO);
  expect(new Set(todos).size).toBe(todos.length);
};

describe("migración 030: número del Pasaporte PetCat", () => {
  let dueno;
  beforeEach(async () => {
    dueno = await crearUsuario();
  });

  // Pase lo que pase, la base queda como la deja petcat.sql para los demás archivos.
  afterAll(correr);

  it("desde cero: rellena todas las mascotas; correrla otra vez no cambia ningún código", async () => {
    await deshacer();
    // Sin trigger: estas mascotas quedan como las existentes antes de la migración.
    await crearMascota(dueno);
    await crearMascota(dueno);

    await correr();
    await verificarEstadoFinal();
    const despuesDeLaPrimera = await codigos();

    await correr();
    await verificarEstadoFinal();
    expect(await codigos()).toEqual(despuesDeLaPrimera);
  });

  it("tras un fallo a mitad (columna nula, sin índice, duplicados, procedimiento suelto) termina bien", async () => {
    await deshacer();
    await pool.query(
      "ALTER TABLE mascotas ADD COLUMN codigo_pasaporte CHAR(12) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER numero_registro"
    );
    await pool.query("CREATE PROCEDURE tmp_030_completar() BEGIN END");
    const repetido = codigoAlAzar();
    const propio = codigoAlAzar();
    const a = await crearMascota(dueno, { codigo_pasaporte: repetido });
    const b = await crearMascota(dueno, { codigo_pasaporte: repetido });
    const c = await crearMascota(dueno, { codigo_pasaporte: repetido });
    const sinCodigo = await crearMascota(dueno);
    const vacio = await crearMascota(dueno, { codigo_pasaporte: "" });
    const conservado = await crearMascota(dueno, { codigo_pasaporte: propio });

    await correr();
    await correr();
    await verificarEstadoFinal();

    const final = await codigos();
    // En cada grupo de duplicados conserva el código la mascota más antigua.
    expect(final.get(a.id_mascota)).toBe(repetido);
    expect(final.get(b.id_mascota)).not.toBe(repetido);
    expect(final.get(c.id_mascota)).not.toBe(repetido);
    expect(final.get(sinCodigo.id_mascota)).toMatch(FORMATO);
    expect(final.get(vacio.id_mascota)).toMatch(FORMATO);
    expect(final.get(conservado.id_mascota)).toBe(propio);
  });

  it("después de migrar, una mascota nueva recibe su código", async () => {
    await correr();
    const nueva = await crearMascota(dueno);
    expect(nueva.codigo_pasaporte).toMatch(FORMATO);
  });
});
