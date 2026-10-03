/**
 * Apunta el proceso a la base de demo (petcat_demo) en lugar de la DB_NAME de backend/.env.
 * Debe importarse antes que src/config/loadEnv.js: dotenv no sobrescribe variables que ya
 * existen, así que el resto de backend/.env (credenciales, JWT, SMTP...) se usa igual.
 */
export const BASE_DEMO = "petcat_demo";

process.env.DB_NAME = BASE_DEMO;
