import { describe, expect, it } from "vitest";
import {
  dinero,
  fechaCorta,
  fechaHora,
  fechaLarga,
  fechaLargaTitulo,
  hora,
  hoyISO,
  iniciales,
  parseFecha,
  parseFechaHora,
} from "./format";

describe("fechas", () => {
  it("parseFecha conserva el día del calendario (no lo corre por UTC)", () => {
    const d = parseFecha("2026-09-01");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 8, 1]);
  });

  it("parseFechaHora acepta con y sin segundos", () => {
    expect(parseFechaHora("2026-09-25 14:30:15").getSeconds()).toBe(15);
    expect(parseFechaHora("2026-09-25 14:30").getHours()).toBe(14);
    expect(() => parseFechaHora("25/09/2026")).toThrow();
  });

  it("formatos en español", () => {
    expect(fechaLarga("2026-09-25")).toBe("viernes, 25 de septiembre de 2026");
    expect(fechaLargaTitulo("2026-09-25")).toBe("Viernes, 25 de septiembre de 2026");
    expect(fechaCorta("2026-09-25")).toBe("25 sep 2026");
    expect(fechaHora("2026-09-25 08:05:00")).toBe("25 sep 2026, 08:05");
  });

  it("hora quita los segundos", () => {
    expect(hora("14:30:00")).toBe("14:30");
    expect(hora("07:15")).toBe("07:15");
    expect(() => hora("7:15")).toThrow();
  });

  it("hoyISO usa la zona de Bogotá", () => {
    // 2026-09-26 03:00 UTC = 2026-09-25 22:00 en Bogotá (UTC-5)
    expect(hoyISO(new Date("2026-09-26T03:00:00Z"))).toBe("2026-09-25");
    expect(hoyISO(new Date("2026-09-26T05:00:00Z"))).toBe("2026-09-26");
  });
});

describe("dinero", () => {
  it("pesos colombianos sin decimales", () => {
    expect(dinero(1850000).replace(/\s/g, " ")).toBe("$ 1.850.000");
    expect(dinero(45000.4).replace(/\s/g, " ")).toBe("$ 45.000");
  });
});

describe("iniciales", () => {
  it.each([
    ["Clínica Veterinaria Patitas", "CP"],
    ["Valentina Torres", "VT"],
    ["Centro Veterinario Salud Animal 24h", "CA"],
    ["Huellitas", "HU"],
    ["  ", "?"],
    ["Ángela", "ÁN"],
  ])("%s -> %s", (nombre, esperado) => {
    expect(iniciales(nombre)).toBe(esperado);
  });
});
