import { afterEach, describe, expect, it, vi } from "vitest";
import cron from "node-cron";
import { JOBS, correrAlArrancar } from "../../src/jobs/index.js";

afterEach(() => vi.restoreAllMocks());

describe("lista de jobs", () => {
  it("todos tienen nombre único y una expresión cron válida", () => {
    const nombres = JOBS.map((j) => j.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
    for (const job of JOBS) expect(cron.validate(job.cada), job.nombre).toBe(true);
  });

  it("al arrancar corren solo los diarios idempotentes", () => {
    expect(JOBS.filter((j) => j.alArrancar).map((j) => j.nombre)).toEqual(["estado-vacunas", "suscripciones", "recordatorios-vacunas"]);
  });
});

describe("correrAlArrancar", () => {
  it("corre en orden los marcados y un error no detiene a los demás", async () => {
    const orden = [];
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const resultados = await correrAlArrancar([
      { nombre: "a", alArrancar: true, tarea: async () => orden.push("a") && 1 },
      { nombre: "b", tarea: async () => orden.push("b") },
      {
        nombre: "c",
        alArrancar: true,
        tarea: async () => {
          orden.push("c");
          throw new Error("falló");
        },
      },
      { nombre: "d", alArrancar: true, tarea: async () => orden.push("d") && 4 },
    ]);

    expect(orden).toEqual(["a", "c", "d"]);
    expect(resultados).toEqual({ a: 1, c: undefined, d: 4 });
    expect(error).toHaveBeenCalledWith("[jobs] c:", "falló");
  });
});
