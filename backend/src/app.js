import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import "./config/zod.js";
import { env, isProduction } from "./config/env.js";
import swaggerSpec from "./docs/swagger.js";

import healthRoutes from "./modules/health/health.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";
import negocioRoutes from "./modules/negocios/negocio.routes.js";
import sucursalRoutes from "./modules/sucursales/sucursal.routes.js";
import empleadoRoutes from "./modules/empleados/empleado.routes.js";
import invitacionRoutes from "./modules/invitaciones/invitacion.routes.js";
import rolRoutes from "./modules/roles/rol.routes.js";
import horarioRoutes from "./modules/horarios/horario.routes.js";
import permisoRoutes from "./modules/permisos/permiso.routes.js";

import { generalLimiter, strictLimiter } from "./shared/middlewares/rateLimit.js";
import { notFound } from "./shared/middlewares/notFound.js";
import { errorHandler } from "./shared/middlewares/errorHandler.js";

const app = express();

// En producción la API va detrás de un proxy: la IP real (para el rate limit) viene en X-Forwarded-For.
if (isProduction) app.set("trust proxy", 1);

// ---------- Seguridad y parseo ----------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        // Fuera de producción se sirve por http (también desde la IP de la red local): no forzar https.
        upgradeInsecureRequests: isProduction ? [] : null,
      },
    },
    strictTransportSecurity: isProduction,
  })
);
app.use(
  cors({
    // Sin cabecera Origin (app móvil, curl, Postman) se permite; en navegador solo los orígenes configurados.
    origin: (origin, callback) => callback(null, !origin || env.CORS_ORIGINS.includes(origin)),
  })
);
app.use(express.json({ limit: "1mb" }));
if (env.NODE_ENV === "development") {
  // El healthcheck de Docker llama cada 10 s: no se registra.
  app.use(morgan("dev", { skip: (req) => req.originalUrl === "/api/v1/health" }));
}

// ---------- API v1 ----------
const v1 = express.Router();

// Health y documentación quedan fuera del límite de solicitudes.
v1.use("/health", healthRoutes);
v1.get("/docs.json", (req, res) => res.json(swaggerSpec));
v1.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: "PetCat API" }));

v1.use(generalLimiter);
v1.use("/auth/login", strictLimiter());
v1.use("/auth/forgot-password", strictLimiter());
v1.use("/invitaciones", strictLimiter());

v1.use("/auth", authRoutes);
v1.use(negocioRoutes);
v1.use("/sucursales", sucursalRoutes);
v1.use("/empleados", empleadoRoutes);
v1.use("/invitaciones", invitacionRoutes);
v1.use("/roles", rolRoutes);
v1.use("/horarios", horarioRoutes);
v1.use(permisoRoutes);

app.use("/api/v1", v1);

// Siempre al final: rutas inexistentes y manejo central de errores.
app.use(notFound);
app.use(errorHandler);

export default app;
