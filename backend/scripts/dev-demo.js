/**
 * Arranca la API contra la base de demo (petcat_demo), con el resto de backend/.env.
 *
 *   npm run dev:demo
 */
import { BASE_DEMO } from "./lib/usarBaseDemo.js";

console.log(`Base de datos: ${BASE_DEMO} (demo)`);
await import("../src/server.js");
