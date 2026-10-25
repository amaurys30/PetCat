import { describe, expect, it } from "vitest";
import {
  dineroCorto,
  etiquetaPunto,
  franjaHoraria,
  porcentaje,
  tasaInasistencia,
  tituloPunto,
  variacionPct,
  variacionPuntos,
} from "./textos";

describe("números", () => {
  it("porcentajes y dinero corto", () => {
    expect(porcentaje(8.3)).toBe("8,3 %");
    expect(porcentaje(null)).toBe("—");
    expect(dineroCorto(1_100_000)).toBe("$1,1 M");
    expect(dineroCorto(480_000)).toBe("$480 mil");
    expect(dineroCorto(900)).toBe("$900");
  });

  it("tasa de inasistencia de una fila; sin base, null", () => {
    expect(tasaInasistencia({ completadas: 7, inasistencias: 1 })).toBe(12.5);
    expect(tasaInasistencia({ completadas: 0, inasistencias: 0 })).toBeNull();
  });
});

describe("variaciones", () => {
  it("porcentaje frente al periodo anterior: subir es bueno salvo que menos sea mejor", () => {
    expect(variacionPct(12)).toEqual({ texto: "12 % vs periodo anterior", sentido: "sube", bueno: true });
    expect(variacionPct(-3.25)).toEqual({
      texto: "3,3 % vs periodo anterior",
      sentido: "baja",
      bueno: false,
    });
    expect(variacionPct(5, { menosEsMejor: true })?.bueno).toBe(false);
    expect(variacionPct(null)).toBeNull();
  });

  it("puntos de la tasa de inasistencia: bajar es bueno", () => {
    expect(variacionPuntos(6, 8)).toEqual({
      texto: "2 pts vs periodo anterior",
      sentido: "baja",
      bueno: true,
    });
    expect(variacionPuntos(9, 8)).toEqual({
      texto: "1 pt vs periodo anterior",
      sentido: "sube",
      bueno: false,
    });
    expect(variacionPuntos(6, null)).toBeNull();
  });
});

describe("fechas y franjas", () => {
  it("franja horaria con el día de la API (0 = domingo)", () => {
    expect(franjaHoraria({ dia_semana: 2, hora: 9 })).toBe("Martes · 9:00–10:00");
    expect(franjaHoraria({ dia_semana: 0, hora: 15 })).toBe("Domingo · 15:00–16:00");
  });

  it("etiquetas y títulos de la tendencia según la agrupación", () => {
    expect(etiquetaPunto("2026-09-28", "semana")).toBe("28 sep");
    expect(etiquetaPunto("2026-09-01", "mes")).toBe("sep");
    expect(tituloPunto("2026-09-28", "semana")).toBe("Semana del 28 de septiembre");
    expect(tituloPunto("2026-09-01", "mes")).toBe("Septiembre de 2026");
    expect(tituloPunto("2026-10-23", "dia")).toBe("Viernes 23 de octubre");
  });
});
