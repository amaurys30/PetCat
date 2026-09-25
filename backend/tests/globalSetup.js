import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import mysql from "mysql2/promise";

/**
 * Se ejecuta una vez antes de todos los tests, en el proceso principal de Vitest
 * (allí no llega test.env), por eso vuelve a leer backend/.env.test.
 * Crea la base de tests si no existe. La carga del esquema llega en 0.C.
 */
export default async function setup() {
  const vars = parse(readFileSync(fileURLToPath(new URL("../.env.test", import.meta.url))));

  if (!vars.DB_NAME?.endsWith("_test")) {
    throw new Error("DB_NAME de backend/.env.test debe terminar en _test");
  }

  const conn = await mysql.createConnection({
    host: vars.DB_HOST,
    port: Number(vars.DB_PORT),
    user: vars.DB_USER,
    password: vars.DB_PASSWORD,
  });
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${vars.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await conn.end();
  }
}
