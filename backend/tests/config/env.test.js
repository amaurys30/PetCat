import { describe, expect, it } from "vitest";
import request from "supertest";
import { env, isTest } from "../../src/config/env.js";
import app from "../../src/app.js";

describe("configuración de tests", () => {
  it("carga las variables de backend/.env.test", () => {
    expect(isTest).toBe(true);
    expect(env.DB_NAME).toMatch(/_test$/);
    expect(env.JWT_SECRET).toMatch(/^test_/);
    expect(process.env.TZ).toBe("America/Bogota");
  });

  it("app.js responde sin pasar por server.js", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });
});
