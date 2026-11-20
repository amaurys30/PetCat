/**
 * Comprueba la base de backend/.env: que tiene las funciones, procedimientos y triggers de
 * database/petcat.sql y que se puede crear una mascota (sin dejar datos: todo se revierte).
 * Para después de restaurar una copia de seguridad: un volcado sin `--routines` no trae las
 * funciones ni los procedimientos, y entonces crear mascotas o confirmar citas falla.
 *
 *   npm run db:verificar
 *   docker compose exec backend npm run db:verificar
 *
 * Sale con código 1 si encuentra un problema.
 */
import "../src/config/loadEnv.js";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";
import { verificarBase } from "./lib/verificarBase.js";

const conn = await mysql.createConnection({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  charset: "utf8mb4",
});

try {
  console.log(`Base: ${env.DB_NAME} en ${env.DB_HOST}:${env.DB_PORT}`);
  const { problemas, codigoDePrueba } = await verificarBase(conn);
  if (problemas.length === 0) {
    console.log(`Todo en orden: funciones, procedimientos y triggers completos; una mascota de prueba recibió ${codigoDePrueba} (revertida).`);
  } else {
    console.error("Problemas:");
    for (const p of problemas) console.error(`  - ${p}`);
    console.error("Si la base viene de una copia, vuelve a sacarla con mysqldump --routines (ver backend/README.md, \"Copias de seguridad\").");
    process.exitCode = 1;
  }
} finally {
  await conn.end();
}
