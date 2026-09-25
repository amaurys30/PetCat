import { Router } from "express";
import pool from "../../config/db.js";
import { ok, sendError } from "../../shared/utils/response.js";

const router = Router();

const DB_TIMEOUT_MS = 2000;

const pingDb = () =>
  Promise.race([
    pool.query("SELECT 1"),
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), DB_TIMEOUT_MS)),
  ]);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Estado de la API y de la base de datos
 *     description: Público. Lo usa el healthcheck de Docker. No cuenta para el límite de solicitudes.
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: API y base de datos disponibles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: OK }
 *                 data:
 *                   type: object
 *                   properties:
 *                     status: { type: string, example: ok }
 *                     db: { type: string, example: ok }
 *                     uptime: { type: integer, description: Segundos desde que arrancó, example: 120 }
 *                     time: { type: string, format: date-time }
 *       503:
 *         description: La base de datos no responde
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Servicio no disponible
 *               errors: { db: sin conexión }
 */
router.get("/", async (req, res) => {
  try {
    await pingDb();
  } catch {
    return sendError(res, 503, "Servicio no disponible", { db: "sin conexión" });
  }
  return ok(res, {
    status: "ok",
    db: "ok",
    uptime: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
});

export default router;
