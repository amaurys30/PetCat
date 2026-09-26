import mysql from "mysql2/promise";
import { env } from "./env.js";

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  // DATE/TIME/DATETIME llegan como texto tal cual están en la base (sin desplazar por zona horaria).
  dateStrings: true,
  timezone: "-05:00",
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * Conexión dedicada para transacciones. Quien la pide debe liberarla con `conn.release()`.
 */
export const getConnection = () => pool.getConnection();

export default pool;
