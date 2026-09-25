import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import "../../src/config/zod.js";
import { validate } from "../../src/shared/middlewares/validate.js";
import { errorHandler } from "../../src/shared/middlewares/errorHandler.js";
import { paginationSchema, getPagination, buildMeta } from "../../src/shared/utils/pagination.js";
import { pick } from "../../src/shared/utils/pick.js";
import { sanitizeUsuario } from "../../src/shared/utils/sanitize.js";

const app = express();
app.use(express.json());
app.post(
  "/negocios/:id_negocio/empleados",
  validate({
    params: z.object({ id_negocio: z.coerce.number().int().positive() }),
    query: paginationSchema,
    body: z.strictObject({ nombre: z.string().min(2), email: z.email() }),
  }),
  (req, res) => res.json({ params: req.params, query: req.query, body: req.body })
);
app.use(errorHandler);

describe("validate", () => {
  it("reemplaza params, query y body por los datos parseados", async () => {
    const res = await request(app)
      .post("/negocios/7/empleados?page=2")
      .send({ nombre: "Ana", email: "ana@petcat.co" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      params: { id_negocio: 7 },
      query: { page: 2, limit: 20 },
      body: { nombre: "Ana", email: "ana@petcat.co" },
    });
  });

  it("responde 422 con un mensaje por campo", async () => {
    const res = await request(app)
      .post("/negocios/abc/empleados?limit=500")
      .send({ nombre: "A", email: "x", rol: "admin" });
    expect(res.status).toBe(422);
    expect(res.body.message).toBe("Datos inválidos");
    expect(res.body.errors).toEqual({
      id_negocio: "Debe ser un número",
      limit: "Debe ser menor o igual a 100",
      nombre: "Mínimo 2 caracteres",
      email: "Correo electrónico inválido",
      rol: "Campo no permitido",
    });
  });

  it("sin body marca los campos obligatorios", async () => {
    const res = await request(app).post("/negocios/1/empleados");
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({ nombre: "Campo obligatorio", email: "Campo obligatorio" });
  });
});

describe("paginación", () => {
  it("getPagination calcula offset y aplica límites", () => {
    expect(getPagination({ page: "3", limit: "10" })).toEqual({ page: 3, limit: 10, offset: 20 });
    expect(getPagination({ page: "-1", limit: "999" })).toEqual({ page: 1, limit: 100, offset: 0 });
    expect(getPagination()).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it("buildMeta", () => {
    expect(buildMeta(45, 2, 20)).toEqual({ total: 45, page: 2, limit: 20, totalPages: 3, hasNext: true });
    expect(buildMeta(45, 3, 20).hasNext).toBe(false);
    expect(buildMeta(0, 1, 20)).toEqual({ total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false });
  });
});

describe("pick y sanitizeUsuario", () => {
  it("pick solo copia campos permitidos y definidos", () => {
    expect(pick({ nombre: "a", id_negocio: 9, telefono: undefined }, ["nombre", "telefono"])).toEqual({ nombre: "a" });
    expect(pick(null, ["nombre"])).toEqual({});
  });

  it("sanitizeUsuario quita los campos sensibles", () => {
    const usuario = {
      id_usuario: 1,
      email: "a@b.co",
      password_hash: "h",
      token_verificacion: "t",
      token_recuperacion: "t",
      token_expiracion: "2026-01-01",
      refresh_token: "r",
    };
    expect(sanitizeUsuario(usuario)).toEqual({ id_usuario: 1, email: "a@b.co" });
    expect(usuario.password_hash).toBe("h");
    expect(sanitizeUsuario(null)).toBeNull();
  });
});
