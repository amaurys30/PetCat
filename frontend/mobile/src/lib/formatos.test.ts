import { hoyEnBogota, parsearFechaApi, partesEnBogota } from "./fechas";
import { formatearDinero, formatearFecha, formatearHora } from "./formatos";

describe("zona del equipo de pruebas", () => {
  it("Jest corre en Asia/Tokyo (UTC+9), no en Bogotá", () => {
    expect(new Date(0).getTimezoneOffset()).toBe(-540);
  });
});

describe("formatearDinero", () => {
  it("pesos sin decimales con puntos de miles", () => {
    expect(formatearDinero(45000)).toBe("$45.000");
    expect(formatearDinero(1250000)).toBe("$1.250.000");
    expect(formatearDinero(0)).toBe("$0");
    expect(formatearDinero(999)).toBe("$999");
  });

  it("acepta los DECIMAL que la API envía como texto y redondea", () => {
    expect(formatearDinero("45000.00")).toBe("$45.000");
    expect(formatearDinero("120000.60")).toBe("$120.001");
  });

  it("negativos y valores inválidos", () => {
    expect(formatearDinero(-4500)).toBe("-$4.500");
    expect(formatearDinero("abc")).toBe("");
  });
});

describe("formatearFecha", () => {
  it("fecha de la API: vie 15 nov", () => {
    expect(formatearFecha("2024-11-15")).toBe("vie 15 nov");
    expect(formatearFecha("2026-09-01")).toBe("mar 1 sept");
    expect(formatearFecha("2026-11-18", { anio: true })).toBe("mié 18 nov 2026");
  });

  it("acepta un DATETIME de la API sin correr el día", () => {
    expect(formatearFecha("2026-11-18 23:30:00")).toBe("mié 18 nov");
  });

  it("un instante se muestra en hora de Bogotá aunque el teléfono esté en otra zona", () => {
    // 03:30 UTC del 15 = 22:30 del 14 en Bogotá (y 12:30 del 15 en Tokio).
    const instante = new Date("2024-11-15T03:30:00Z");
    expect(formatearFecha(instante)).toBe("jue 14 nov");
    expect(formatearHora(instante)).toBe("10:30 p. m.");
  });
});

describe("formatearHora", () => {
  it("8:30 a. m. y la tarde", () => {
    expect(formatearHora("08:30")).toBe("8:30 a. m.");
    expect(formatearHora("08:30:00")).toBe("8:30 a. m.");
    expect(formatearHora("17:05")).toBe("5:05 p. m.");
  });

  it("medianoche y mediodía", () => {
    expect(formatearHora("00:00")).toBe("12:00 a. m.");
    expect(formatearHora("12:00")).toBe("12:00 p. m.");
    expect(formatearHora("12:45")).toBe("12:45 p. m.");
    expect(formatearHora("23:59")).toBe("11:59 p. m.");
  });

  it("la hora de un DATETIME", () => {
    expect(formatearHora("2026-11-18 14:15:00")).toBe("2:15 p. m.");
  });
});

describe("fechas en Bogotá", () => {
  it("hoy en Bogotá cambia a medianoche de Colombia, no del teléfono", () => {
    expect(hoyEnBogota(new Date("2026-11-19T04:59:00Z"))).toBe("2026-11-18");
    expect(hoyEnBogota(new Date("2026-11-19T05:00:00Z"))).toBe("2026-11-19");
  });

  it("partes y día de la semana", () => {
    expect(partesEnBogota(new Date("2026-01-01T04:00:00Z"))).toMatchObject({ anio: 2025, mes: 12, dia: 31 });
    expect(parsearFechaApi("2026-11-18").diaSemana).toBe(3);
  });

  it("rechaza fechas y horas mal formadas", () => {
    expect(() => formatearFecha("18/11/2026")).toThrow("Fecha inválida");
    expect(() => formatearHora("8 am")).toThrow("Hora inválida");
  });
});
