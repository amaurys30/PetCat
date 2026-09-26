import { readdirSync } from "node:fs";
import path from "node:path";
import { runSqlFile } from "./sqlRunner.js";

/**
 * Migraciones de database/migrations: archivos `NNN_descripcion.sql`, aplicados
 * en orden de nombre. Cada migración aplicada se registra por su nombre de archivo
 * en `schema_migrations` (no por "el número más alto"), así una base a la que se le
 * aplicaron a mano en otro orden queda bien descrita.
 */

export const MIGRATION_FILE = /^\d{3}_[a-z0-9_]+\.sql$/;

// Debe coincidir con la definición de database/petcat.sql.
const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    nombre      VARCHAR(255) NOT NULL,
    aplicada_en DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (nombre)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='Migraciones de database/migrations ya aplicadas (npm run db:migrate)'`;

/** Archivos de migración del directorio, ordenados por nombre. */
export const listMigrationFiles = (dir) =>
  readdirSync(dir)
    .filter((file) => MIGRATION_FILE.test(file))
    .sort();

export const ensureTable = async (conn) => {
  await conn.query(CREATE_TABLE);
};

/** Migraciones registradas; lista vacía si la tabla aún no existe (no la crea). */
export const getApplied = async (conn) => {
  const [tablas] = await conn.query("SHOW TABLES LIKE 'schema_migrations'");
  if (tablas.length === 0) return [];
  const [rows] = await conn.query("SELECT nombre, aplicada_en FROM schema_migrations ORDER BY nombre");
  return rows;
};

/**
 * { aplicadas: [{ nombre, aplicada_en }], pendientes: [nombre], desconocidas: [nombre] }.
 * Solo lee: no crea la tabla.
 */
export const getStatus = async (conn, dir) => {
  const files = listMigrationFiles(dir);
  const aplicadas = await getApplied(conn);
  const nombres = new Set(aplicadas.map((m) => m.nombre));
  return {
    aplicadas,
    pendientes: files.filter((file) => !nombres.has(file)),
    // Registradas en la base pero sin archivo (p. ej. otra rama): solo se informan.
    desconocidas: aplicadas.map((m) => m.nombre).filter((nombre) => !files.includes(nombre)),
  };
};

/**
 * Aplica las pendientes en orden y registra cada una justo después de ejecutarla.
 * Si una falla, se detiene sin registrarla y lanza el error con `migracion`.
 * MySQL confirma cada sentencia DDL al ejecutarla: una migración que falla a mitad
 * puede dejar cambios parciales que hay que revisar a mano.
 */
export const migrate = async (conn, dir, { log = () => {} } = {}) => {
  await ensureTable(conn);
  const { pendientes } = await getStatus(conn, dir);
  for (const nombre of pendientes) {
    log(`Aplicando ${nombre}...`);
    try {
      await runSqlFile(conn, path.join(dir, nombre));
    } catch (err) {
      err.migracion = nombre;
      throw err;
    }
    await conn.query("INSERT INTO schema_migrations (nombre) VALUES (?)", [nombre]);
  }
  return pendientes;
};

/**
 * Registra todas las migraciones existentes como aplicadas sin ejecutarlas, para
 * una base a la que se le aplicaron a mano. Solo con la tabla vacía: si ya hay
 * registros, lanza un error y no marca nada.
 */
export const baseline = async (conn, dir) => {
  await ensureTable(conn);
  const aplicadas = await getApplied(conn);
  if (aplicadas.length > 0) {
    throw new Error(
      `schema_migrations ya tiene ${aplicadas.length} registro(s): --baseline solo se usa con la tabla vacía. ` +
        "Usa npm run db:migrate -- --status para ver el estado."
    );
  }
  const files = listMigrationFiles(dir);
  if (files.length > 0) {
    await conn.query("INSERT INTO schema_migrations (nombre) VALUES ?", [files.map((file) => [file])]);
  }
  return files;
};
