import { describe, expect, it } from "vitest";
import { calcularEstados, normalizarNombre } from "../../src/modules/vacunas/vacuna.calculo.js";

const HOY = "2026-10-01";
const v = (id_vacuna, nombre_vacuna, fecha_aplicacion, fecha_proxima = null) => ({
  id_vacuna,
  nombre_vacuna,
  fecha_aplicacion,
  fecha_proxima,
});
const estados = (vacunas) => Object.fromEntries(calcularEstados(vacunas, HOY, 30));

describe("calcularEstados", () => {
  it("vencido, próximo (dentro de 30 días) y al día", () => {
    expect(
      estados([
        v(1, "Rabia", "2025-09-01", "2026-09-30"),
        v(2, "Parvovirus", "2025-10-01", "2026-10-31"),
        v(3, "Moquillo", "2025-10-01", "2026-11-01"),
        v(4, "Leptospira", "2026-01-01", HOY),
      ])
    ).toEqual({ 1: "vencido", 2: "proximo", 3: "al_dia", 4: "proximo" });
  });

  it("sin fecha_proxima (dosis única) está al día", () => {
    expect(estados([v(1, "Rabia", "2026-01-01")])).toEqual({ 1: "al_dia" });
  });

  it("las dosis anteriores de la misma vacuna son no_aplica aunque su fecha haya pasado", () => {
    expect(
      estados([
        v(1, "Antirrábica", "2024-01-01", "2025-01-01"),
        v(2, " antirrabica ", "2025-12-01", "2026-12-01"),
        v(3, "ANTIRRÁBICA", "2025-06-01", "2026-06-01"),
      ])
    ).toEqual({ 1: "no_aplica", 2: "al_dia", 3: "no_aplica" });
  });

  it("con la misma fecha de aplicación, la vigente es la de mayor id", () => {
    expect(estados([v(7, "Rabia", "2026-01-01"), v(5, "rabia", "2026-01-01", "2026-02-01")])).toEqual({
      7: "al_dia",
      5: "no_aplica",
    });
  });

  it("normalizarNombre ignora tildes, mayúsculas y espacios repetidos", () => {
    expect(normalizarNombre("  Triple   Felina ÁÉ ")).toBe("triple felina ae");
  });
});
