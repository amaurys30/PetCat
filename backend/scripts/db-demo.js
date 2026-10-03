/**
 * Recrea la base de demo (petcat_demo) con el esquema y el seed de desarrollo.
 * No toca la base de backend/.env (petcat_db). Es la que usa el panel web para probar
 * contra datos conocidos; se puede recrear cuantas veces haga falta.
 *
 *   npm run db:demo                                  (en el host)
 *   docker compose exec backend-demo node scripts/db-demo.js   (en Docker)
 *   node scripts/db-demo.js --si-no-existe           solo si todavía no existe (arranque del contenedor)
 */
import { BASE_DEMO } from "./lib/usarBaseDemo.js";

if (process.argv.includes("--si-no-existe")) {
  await import("../src/config/loadEnv.js");
  const { env } = await import("../src/config/env.js");
  const { default: mysql } = await import("mysql2/promise");
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  });
  const [filas] = await conn.query("SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?", [BASE_DEMO]);
  await conn.end();
  if (filas.length > 0) {
    console.log(`La base ${BASE_DEMO} ya existe: no se recrea.`);
    process.exit(0);
  }
}

process.argv.push("--yes");
await import("./db-reset.js");
