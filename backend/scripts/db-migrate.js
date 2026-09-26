/**
 * Aplica las migraciones pendientes de database/migrations a la base de backend/.env.
 *
 *   npm run db:migrate                  aplica las pendientes en orden
 *   npm run db:migrate -- --status      muestra aplicadas y pendientes, sin cambiar nada
 *   npm run db:migrate -- --baseline    marca todas las existentes como aplicadas SIN ejecutarlas
 *                                       (una sola vez, en una base a la que se le aplicaron a mano;
 *                                       solo funciona con schema_migrations vacía)
 *
 * Se corre desde el host (usa backend/.env: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).
 * Una base creada con database/petcat.sql ya trae registradas todas las migraciones existentes.
 */
import "../src/config/loadEnv.js";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";
import { baseline, getStatus, migrate } from "./lib/migrator.js";

const args = process.argv.slice(2);
const dir = fileURLToPath(new URL("../../database/migrations/", import.meta.url));
const destino = `${env.DB_NAME} en ${env.DB_HOST}:${env.DB_PORT}`;

const conocidos = ["--status", "--baseline"];
const desconocido = args.find((arg) => !conocidos.includes(arg));
if (desconocido || args.length > 1) {
  console.error(`Opción no válida: ${desconocido ?? args.join(" ")}. Usa --status, --baseline o nada.`);
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  charset: "utf8mb4",
  dateStrings: true,
});

try {
  if (args[0] === "--status") {
    const { aplicadas, pendientes, desconocidas } = await getStatus(conn, dir);
    console.log(`Base: ${destino}`);
    console.log(`Aplicadas (${aplicadas.length}):`);
    for (const m of aplicadas) console.log(`  ${m.nombre}  (${m.aplicada_en})`);
    console.log(`Pendientes (${pendientes.length}):`);
    for (const nombre of pendientes) console.log(`  ${nombre}`);
    if (desconocidas.length > 0) {
      console.log(`Registradas sin archivo en database/migrations (${desconocidas.length}):`);
      for (const nombre of desconocidas) console.log(`  ${nombre}`);
    }
  } else if (args[0] === "--baseline") {
    const marcadas = await baseline(conn, dir);
    console.log(`Base: ${destino}`);
    console.log(`Marcadas como aplicadas sin ejecutarlas (${marcadas.length}):`);
    for (const nombre of marcadas) console.log(`  ${nombre}`);
  } else {
    const aplicadas = await migrate(conn, dir, { log: (msg) => console.log(msg) });
    console.log(
      aplicadas.length === 0
        ? `La base ${destino} está al día: no hay migraciones pendientes.`
        : `Listo: ${aplicadas.length} migración(es) aplicada(s) en ${destino}.`
    );
  }
} catch (err) {
  if (err.migracion) {
    console.error(`Falló ${err.migracion}; no se registró y no se aplicaron las siguientes.`);
    console.error("MySQL confirma cada DDL al ejecutarlo: revisa si la migración quedó aplicada a medias.");
  }
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
