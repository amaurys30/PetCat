import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import "../../src/config/zod.js";
import { ApiError } from "../../src/shared/errors/ApiError.js";
import { errorHandler } from "../../src/shared/middlewares/errorHandler.js";
import { notFound } from "../../src/shared/middlewares/notFound.js";

// App mínima: GET /throw lanza el error que se le pase.
const appThrowing = (makeError) => {
  const app = express();
  app.use(express.json({ limit: "1kb" }));
  app.get("/throw", async () => {
    throw makeError();
  });
  app.post("/echo", (req, res) => res.json(req.body));
  app.use(notFound);
  app.use(errorHandler);
  return app;
};

const mysqlError = (code, sqlMessage = "") => Object.assign(new Error(sqlMessage), { code, sqlMessage });

describe("ApiError", () => {
  it.each([
    ["badRequest", 400],
    ["unauthorized", 401],
    ["forbidden", 403],
    ["notFound", 404],
    ["conflict", 409],
    ["unprocessable", 422],
    ["tooMany", 429],
    ["internal", 500],
  ])("%s -> %i con mensaje por defecto", (name, status) => {
    const err = ApiError[name]();
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(status);
    expect(err.message).toBeTruthy();
  });

  it("conserva mensaje y errores por campo", () => {
    const err = ApiError.unprocessable("Datos inválidos", { email: "Inválido" });
    expect(err.message).toBe("Datos inválidos");
    expect(err.errors).toEqual({ email: "Inválido" });
  });
});

describe("errorHandler", () => {
  it("ApiError usa su status, mensaje y errors", async () => {
    const res = await request(appThrowing(() => ApiError.conflict("Horario ocupado", { hora: "Ocupada" }))).get("/throw");
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: "Horario ocupado", errors: { hora: "Ocupada" } });
  });

  it("ZodError -> 422 con errores por campo en español", async () => {
    const res = await request(
      appThrowing(() => z.object({ email: z.email() }).safeParse({ email: "x" }).error)
    ).get("/throw");
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({ email: "Correo electrónico inválido" });
  });

  it("JSON inválido -> 400", async () => {
    const res = await request(appThrowing(() => null))
      .post("/echo")
      .set("Content-Type", "application/json")
      .send("{mal");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("cuerpo demasiado grande -> 413", async () => {
    const res = await request(appThrowing(() => null)).post("/echo").send({ x: "a".repeat(2000) });
    expect(res.status).toBe(413);
  });

  it.each([
    ["ER_DUP_ENTRY", "Duplicate entry 'a@b.co' for key 'usuarios.email'", 409, undefined],
    ["ER_ROW_IS_REFERENCED_2", "Cannot delete or update a parent row", 409, undefined],
    ["ER_NO_REFERENCED_ROW_2", "Cannot add or update a child row", 400, undefined],
    ["ER_DATA_TOO_LONG", "Data too long for column 'nombre' at row 1", 400, "nombre"],
    ["WARN_DATA_TRUNCATED", "Data truncated for column 'tipo' at row 1", 400, "tipo"],
    ["ER_TRUNCATED_WRONG_VALUE", "Incorrect date value: 'x' for column 'fecha' at row 1", 400, "fecha"],
    ["ER_TRUNCATED_WRONG_VALUE_FOR_FIELD", "Incorrect integer value: 'x' for column 'n' at row 1", 400, "n"],
    ["ER_WARN_DATA_OUT_OF_RANGE", "Out of range value for column 'n' at row 1", 400, "n"],
    ["ER_BAD_NULL_ERROR", "Column 'nombre' cannot be null", 400, "nombre"],
  ])("MySQL %s -> %i", async (code, sqlMessage, status, column) => {
    const res = await request(appThrowing(() => mysqlError(code, sqlMessage))).get("/throw");
    expect(res.status).toBe(status);
    expect(res.body.success).toBe(false);
    expect(res.body.message).not.toContain(sqlMessage);
    if (column) {
      expect(res.body.message).toContain(column);
      expect(Object.keys(res.body.errors)).toEqual([column]);
    }
  });

  it("respeta error.status de los módulos anteriores a 0.C", async () => {
    const res = await request(
      appThrowing(() => Object.assign(new Error("Empleado no encontrado"), { status: 404 }))
    ).get("/throw");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Empleado no encontrado");
  });

  it("error desconocido -> 500 sin exponer el stack", async () => {
    const res = await request(appThrowing(() => new Error("detalle interno"))).get("/throw");
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Error interno del servidor");
    expect(JSON.stringify(res.body)).not.toContain("at ");
  });

  it("ruta inexistente -> 404 con método y ruta", async () => {
    const res = await request(appThrowing(() => null)).get("/no/existe?x=1");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: "Ruta no encontrada: GET /no/existe" });
  });
});
