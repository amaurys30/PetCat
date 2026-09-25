import dotenv from "dotenv";

// Carga backend/.env. Debe ser el primer import de server.js para que las
// variables existan antes de que cualquier módulo lea config/env.js.
dotenv.config({ quiet: true });
