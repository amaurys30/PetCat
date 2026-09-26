import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { splitSqlStatements } from "../../scripts/lib/sqlRunner.js";

const archivo = (relativo) => fileURLToPath(new URL(`../../../${relativo}`, import.meta.url));

// docker compose carga petcat.sql y el seed con el cliente mysql, que usa latin1 por
// defecto: si SET NAMES no va primero, las tildes quedan codificadas dos veces.
describe("scripts SQL con texto", () => {
  it.each(["database/petcat.sql", "database/seeds/dev_seed.sql", "database/scripts/reparar_codificacion_utf8.sql"])(
    "%s empieza con SET NAMES utf8mb4",
    (ruta) => {
      const [primera] = splitSqlStatements(readFileSync(archivo(ruta), "utf8"));
      expect(primera).toMatch(/^SET NAMES utf8mb4$/i);
    }
  );
});
