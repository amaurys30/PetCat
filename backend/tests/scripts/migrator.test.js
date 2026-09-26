import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";
import { pool } from "../../src/config/db.js";
import { baseline, getStatus, listMigrationFiles, migrate } from "../../scripts/lib/migrator.js";

const MIGRATIONS_DIR = fileURLToPath(new URL("../../../database/migrations/", import.meta.url));
const DB = "petcat_migrate_test";

describe("database/petcat.sql y database/migrations", () => {
  it("cada archivo de migración está registrado en schema_migrations de una base nueva, y nada más", async () => {
    const [rows] = await pool.query("SELECT nombre FROM schema_migrations ORDER BY nombre");
    expect(rows.map((r) => r.nombre)).toEqual(listMigrationFiles(MIGRATIONS_DIR));
    expect(listMigrationFiles(MIGRATIONS_DIR).length).toBeGreaterThanOrEqual(3);
  });
});

describe("migrator (base temporal)", () => {
  let conn;
  let dir;

  const escribir = (nombre, sql) => writeFileSync(path.join(dir, nombre), sql);
  const tablas = async () => {
    const [rows] = await conn.query("SHOW TABLES");
    return rows.map((r) => Object.values(r)[0]).sort();
  };
  const registradas = async () => (await getStatus(conn, dir)).aplicadas.map((m) => m.nombre);

  beforeAll(async () => {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      charset: "utf8mb4",
    });
  });

  beforeEach(async () => {
    await conn.query(`DROP DATABASE IF EXISTS ${DB}`);
    await conn.query(`CREATE DATABASE ${DB}`);
    await conn.changeUser({ database: DB });
    dir = mkdtempSync(path.join(tmpdir(), "petcat-migraciones-"));
    escribir("001_crear_a.sql", "-- comentario\nCREATE TABLE a (id INT PRIMARY KEY);");
    escribir("002_crear_b.sql", "CREATE TABLE b (id INT PRIMARY KEY);\nINSERT INTO b VALUES (1);");
    escribir("notas.txt", "no es una migración");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  afterAll(async () => {
    await conn.query(`DROP DATABASE IF EXISTS ${DB}`);
    await conn.end();
  });

  it("solo toma archivos NNN_nombre.sql, ordenados", () => {
    escribir("010_despues.sql", "SELECT 1;");
    escribir("3_mal_nombre.sql", "SELECT 1;");
    expect(listMigrationFiles(dir)).toEqual(["001_crear_a.sql", "002_crear_b.sql", "010_despues.sql"]);
  });

  it("aplica las pendientes en orden, las registra y una segunda corrida no hace nada", async () => {
    expect(await migrate(conn, dir)).toEqual(["001_crear_a.sql", "002_crear_b.sql"]);
    expect(await tablas()).toEqual(["a", "b", "schema_migrations"]);
    expect(await registradas()).toEqual(["001_crear_a.sql", "002_crear_b.sql"]);

    expect(await migrate(conn, dir)).toEqual([]);

    escribir("003_crear_c.sql", "CREATE TABLE c (id INT);");
    expect(await migrate(conn, dir)).toEqual(["003_crear_c.sql"]);
  });

  it("registra por nombre: aplica una anterior que falte aunque haya otras posteriores registradas", async () => {
    await conn.query("CREATE TABLE b (id INT PRIMARY KEY)");
    await baseline(conn, dir); // marca 001 y 002
    await conn.query("DELETE FROM schema_migrations WHERE nombre = '001_crear_a.sql'");

    expect((await getStatus(conn, dir)).pendientes).toEqual(["001_crear_a.sql"]);
    expect(await migrate(conn, dir)).toEqual(["001_crear_a.sql"]);
  });

  it("si una migración falla, se detiene sin registrarla ni aplicar las siguientes", async () => {
    escribir("002_crear_b.sql", "CREATE TABLE b (id INT PRIMARY KEY);\nESTO NO ES SQL;");
    escribir("003_crear_c.sql", "CREATE TABLE c (id INT);");

    await expect(migrate(conn, dir)).rejects.toMatchObject({ migracion: "002_crear_b.sql" });
    expect(await registradas()).toEqual(["001_crear_a.sql"]);
    expect(await tablas()).not.toContain("c");
  });

  it("baseline marca todas sin ejecutarlas y solo funciona con la tabla vacía", async () => {
    expect(await baseline(conn, dir)).toEqual(["001_crear_a.sql", "002_crear_b.sql"]);
    expect(await tablas()).toEqual(["schema_migrations"]);
    expect(await migrate(conn, dir)).toEqual([]);

    await expect(baseline(conn, dir)).rejects.toThrow(/solo se usa con la tabla vacía/);
  });

  it("status no crea la tabla: sin ella, todo está pendiente", async () => {
    const status = await getStatus(conn, dir);
    expect(status).toEqual({ aplicadas: [], pendientes: ["001_crear_a.sql", "002_crear_b.sql"], desconocidas: [] });
    expect(await tablas()).toEqual([]);
  });

  it("status informa las registradas que ya no tienen archivo", async () => {
    await migrate(conn, dir);
    rmSync(path.join(dir, "002_crear_b.sql"));
    const status = await getStatus(conn, dir);
    expect(status.desconocidas).toEqual(["002_crear_b.sql"]);
    expect(status.pendientes).toEqual([]);
  });
});
