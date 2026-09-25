import { z } from "zod";

/**
 * Variables de entorno validadas. Este módulo NO carga archivos .env:
 * - server.js importa config/loadEnv.js como primera línea (lee backend/.env).
 * - Vitest las inyecta desde backend/.env.test (ver vitest.config.js).
 * - En Docker llegan por env_file/environment de docker-compose.yml.
 */

const duration = z
  .string()
  .regex(/^\d+\s*(ms|s|m|h|d|w|y)?$/, "Duración inválida (ejemplos: 15m, 1h, 7d)");

const required = () =>
  z.string({
    error: (issue) => (issue.input === undefined ? "Variable obligatoria" : undefined),
  });

const secret = required().min(32, "Debe tener al menos 32 caracteres");

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),

    DB_HOST: z.string().default("localhost"),
    DB_PORT: z.coerce.number().int().positive().default(3306),
    DB_USER: required(),
    DB_PASSWORD: required(),
    DB_NAME: required(),

    JWT_SECRET: secret,
    JWT_EXPIRES_IN: duration.default("1h"),
    REFRESH_SECRET: secret,
    REFRESH_EXPIRES_IN: duration.default("7d"),

    APP_URL: z.url().default("http://localhost:3000"),
    FRONTEND_URL: z.url().default("http://localhost:5173"),
    CORS_ORIGINS: z
      .string()
      .default("http://localhost:5173")
      .transform((value) =>
        value
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean)
      ),

    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().default("PetCat <no-reply@petcat.co>"),

    // Máximo de solicitudes cada 15 min por IP en login, forgot-password e invitaciones.
    // Por defecto: 10 en producción, 100 en desarrollo y tests.
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.JWT_SECRET === data.REFRESH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["REFRESH_SECRET"],
        message: "Debe ser distinto de JWT_SECRET",
      });
    }
    if (data.NODE_ENV === "production" && !data.SMTP_HOST) {
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_HOST"],
        message: "Obligatoria en producción (sin SMTP los correos solo se muestran en consola)",
      });
    }
    // Los tests borran y recrean datos: nunca deben apuntar a la base de desarrollo.
    if (data.NODE_ENV === "test" && !data.DB_NAME.endsWith("_test")) {
      ctx.addIssue({
        code: "custom",
        path: ["DB_NAME"],
        message: "Con NODE_ENV=test la base debe terminar en _test",
      });
    }
  });

// Una variable definida pero vacía (`SMTP_HOST=`) cuenta como ausente.
const raw = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== "")
);

const parsed = schema.safeParse(raw);

if (!parsed.success) {
  const detalle = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  const mensaje = `Variables de entorno inválidas o faltantes:\n${detalle}`;

  // En tests se lanza el error para que Vitest lo muestre; en el servidor se termina el proceso.
  if (process.env.NODE_ENV === "test") throw new Error(mensaje);
  console.error(mensaje);
  process.exit(1);
}

// Con dateStrings las fechas llegan de MySQL en hora de Bogotá sin zona; el proceso
// usa la misma zona para que `new Date("2026-01-01 10:00:00")` se interprete igual
// en cualquier máquina o contenedor (el de Node en Docker está en UTC).
process.env.TZ = "America/Bogota";

export const env = Object.freeze({
  ...parsed.data,
  AUTH_RATE_LIMIT_MAX:
    parsed.data.AUTH_RATE_LIMIT_MAX ?? (parsed.data.NODE_ENV === "production" ? 10 : 100),
});

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
