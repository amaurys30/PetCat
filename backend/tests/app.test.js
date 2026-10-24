import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("app", () => {
  it("GET /api/v1/health comprueba la base de datos", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { status: "ok", db: "ok" } });
  });

  it("las rutas viejas sin /api/v1 y /usuarios ya no existen", async () => {
    for (const path of ["/health", "/api/auth/login", "/api/v1/usuarios"]) {
      const res = await request(app).get(path);
      expect(res.status, path).toBe(404);
      expect(res.body.success).toBe(false);
    }
  });

  it("JSON inválido en una ruta real -> 400", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send("{mal");
    expect(res.status).toBe(400);
  });

  it("cabeceras de seguridad de helmet", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("CORS solo para los orígenes configurados", async () => {
    const permitido = await request(app).get("/api/v1/health").set("Origin", "http://localhost:5173");
    expect(permitido.headers["access-control-allow-origin"]).toBe("http://localhost:5173");

    const ajeno = await request(app).get("/api/v1/health").set("Origin", "http://malicioso.com");
    expect(ajeno.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("el rate limit no se aplica en tests", async () => {
    const res = await request(app).get("/api/v1/negocios/mios");
    expect(res.headers.ratelimit).toBeUndefined();
  });

  it("Swagger en /api/v1/docs y la especificación en /api/v1/docs.json", async () => {
    const docs = await request(app).get("/api/v1/docs/");
    expect(docs.status).toBe(200);

    const spec = await request(app).get("/api/v1/docs.json");
    expect(spec.status).toBe(200);
    expect(spec.body.servers[0].url).toBe("/api/v1");
    expect(spec.body.paths).toHaveProperty("/health");
    expect(spec.body.paths).toHaveProperty("/auth/login");
    expect(spec.body.components.responses).toHaveProperty("ValidationError");
  });

  it("Swagger sin descripciones cortadas por una coma en un mapeo en línea", async () => {
    // En `{ type: integer, description: A, B }` YAML corta la descripción en la coma y deja
    // la clave `B` con valor null: esas descripciones van entre comillas.
    const spec = (await request(app).get("/api/v1/docs.json")).body;
    const cortadas = [];
    const recorrer = (nodo, ruta) => {
      if (!nodo || typeof nodo !== "object") return;
      for (const [clave, valor] of Object.entries(nodo)) {
        if (valor === null && /s/.test(clave)) cortadas.push(`${ruta}.${clave}`);
        recorrer(valor, `${ruta}.${clave}`);
      }
    };
    recorrer(spec, "");
    expect(cortadas).toEqual([]);
  });
});
