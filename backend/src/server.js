import "./config/loadEnv.js";
import app from "./app.js";
import { env } from "./config/env.js";
import { iniciarJobs } from "./jobs/index.js";

app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`Servidor corriendo en http://localhost:${env.PORT} (${env.NODE_ENV})`);
  console.log(`Swagger: http://localhost:${env.PORT}/api/v1/docs`);
  iniciarJobs();
});
