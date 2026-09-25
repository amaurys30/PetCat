/**
 * Recrea la base de desarrollo desde cero: borra DB_NAME, carga database/petcat.sql
 * y el seed de desarrollo. BORRA TODOS LOS DATOS de esa base.
 *
 *   npm run db:reset -- --yes             esquema + seed
 *   npm run db:reset -- --yes --sin-seed  solo el esquema
 *
 * Usa las variables de backend/.env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).
 * Se niega a correr con NODE_ENV=production.
 */
import "../src/config/loadEnv.js";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";
import { runSqlFile } from "./lib/sqlRunner.js";

const args = process.argv.slice(2);
const fromRoot = (relative) => fileURLToPath(new URL(`../../${relative}`, import.meta.url));

if (env.NODE_ENV === "production") {
  console.error("db:reset no se puede ejecutar con NODE_ENV=production.");
  process.exit(1);
}

if (!args.includes("--yes")) {
  console.error(
    `Esto borra la base "${env.DB_NAME}" en ${env.DB_HOST}:${env.DB_PORT} y la recrea desde cero.\n` +
      "Para confirmar: npm run db:reset -- --yes"
  );
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  charset: "utf8mb4",
});

try {
  await conn.query(`DROP DATABASE IF EXISTS \`${env.DB_NAME}\``);
  const schema = await runSqlFile(conn, fromRoot("database/petcat.sql"), { replaceDbName: env.DB_NAME });
  console.log(`Esquema cargado en ${env.DB_NAME} (${schema} sentencias).`);

  if (!args.includes("--sin-seed")) {
    const seed = await runSqlFile(conn, fromRoot("database/seeds/dev_seed.sql"), {
      replaceDbName: env.DB_NAME,
    });
    console.log(`Seed de desarrollo cargado (${seed} sentencias). Contraseña de los usuarios: Petcat123!`);
  }
} finally {
  await conn.end();
}
