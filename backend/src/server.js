import "./config/loadEnv.js";
import http from "node:http";
import app from "./app.js";
import { env } from "./config/env.js";
import { iniciarJobs } from "./jobs/index.js";
import { iniciarSocket } from "./realtime/socket.js";

// Un solo servidor HTTP para la API y Socket.IO (mismo puerto).
const server = http.createServer(app);
iniciarSocket(server);

server.listen(env.PORT, "0.0.0.0", () => {
  console.log(`Servidor corriendo en http://localhost:${env.PORT} (${env.NODE_ENV})`);
  console.log(`Swagger: http://localhost:${env.PORT}/api/v1/docs`);
  iniciarJobs();
});
