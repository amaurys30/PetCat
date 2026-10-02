/**
 * Recrea la base de demo (petcat_demo) con el esquema y el seed de desarrollo.
 * No toca la base de backend/.env (petcat_db). Es la que usa el panel web para probar
 * contra datos conocidos; se puede recrear cuantas veces haga falta.
 *
 *   npm run db:demo
 */
import "./lib/usarBaseDemo.js";

process.argv.push("--yes");
await import("./db-reset.js");
