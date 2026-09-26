import { afterAll } from "vitest";
import { pool } from "../src/config/db.js";

// Cada archivo de tests corre en su propio worker con su propio pool: se cierra al terminar.
afterAll(async () => {
  await pool.end();
});
