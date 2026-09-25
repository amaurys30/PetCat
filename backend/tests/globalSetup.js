import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import mysql from "mysql2/promise";
import { runSqlFile } from "../scripts/lib/sqlRunner.js";

const fromRoot = (relative) => fileURLToPath(new URL(`../../${relative}`, import.meta.url));

/**
 * Se ejecuta una vez antes de todos los tests, en el proceso principal de Vitest
 * (allí no llega test.env), por eso vuelve a leer backend/.env.test.
 * Recrea la base de tests desde cero con el esquema y el seed de desarrollo:
 * cada corrida empieza igual y los tests crean sus propios datos.
 */
export default async function setup() {
  const vars = parse(readFileSync(fileURLToPath(new URL("../.env.test", import.meta.url))));
  const dbName = vars.DB_NAME;

  if (!dbName?.endsWith("_test")) {
    throw new Error("DB_NAME de backend/.env.test debe terminar en _test");
  }

  const conn = await mysql.createConnection({
    host: vars.DB_HOST,
    port: Number(vars.DB_PORT),
    user: vars.DB_USER,
    password: vars.DB_PASSWORD,
    charset: "utf8mb4",
  });
  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await runSqlFile(conn, fromRoot("database/petcat.sql"), { replaceDbName: dbName });
    await runSqlFile(conn, fromRoot("database/seeds/dev_seed.sql"), { replaceDbName: dbName });
  } finally {
    await conn.end();
  }
}
