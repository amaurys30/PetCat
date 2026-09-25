import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { defineConfig } from "vitest/config";

/**
 * Los tests importan app.js directamente (sin server.js), así que nadie carga
 * backend/.env. Las variables salen solo de backend/.env.test y se inyectan en
 * process.env antes de importar cualquier módulo; src/config/env.js las valida
 * igual que en el servidor y exige que DB_NAME termine en _test.
 */
const envTestPath = fileURLToPath(new URL("./.env.test", import.meta.url));

if (!existsSync(envTestPath)) {
  throw new Error("Falta backend/.env.test. Cópialo desde backend/.env.test.example.");
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    globalSetup: ["tests/globalSetup.js"],
    env: {
      ...parse(readFileSync(envTestPath)),
      NODE_ENV: "test",
    },
    // Todos los archivos comparten la base petcat_test: se ejecutan uno a la vez.
    fileParallelism: false,
  },
});
