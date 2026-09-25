import express from "express";

// routes
import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./routes/users.routes.js"; // si lo tienes
import negocioRoutes from "./modules/negocios/negocio.routes.js";
import sucursalRoutes from "./modules/sucursales/sucursal.routes.js";
import empleadoRoutes from "./modules/empleados/empleado.routes.js";
import invitacionRoutes from "./modules/invitaciones/invitacion.routes.js";
import rolRoutes from "./modules/roles/rol.routes.js";
import horarioRoutes from "./modules/horarios/horario.routes.js";

// swagger
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./docs/swagger.js";

import { notFound } from "./shared/middlewares/notFound.js";
import { errorHandler } from "./shared/middlewares/errorHandler.js";

const app = express();

// ========================
// MIDDLEWARE GLOBAL
// ========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================
// ROUTES
// ========================
app.use("/api/auth", authRoutes);
app.use("/api/usuarios", userRoutes);
app.use("/api/negocios", negocioRoutes);
app.use("/api/sucursales", sucursalRoutes);
app.use("/api/empleados", empleadoRoutes);
app.use("/api/invitaciones", invitacionRoutes);
app.use("/api/roles", rolRoutes);
app.use("/api/horarios", horarioRoutes);


// ========================
// SWAGGER
// ========================
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ========================
// HEALTH CHECK
// ========================
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "PetCat API",
    time: new Date(),
  });
});

// Siempre al final: rutas inexistentes y manejo central de errores.
app.use(notFound);
app.use(errorHandler);

export default app;