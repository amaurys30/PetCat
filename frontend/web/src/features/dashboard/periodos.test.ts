import { describe, expect, it } from "vitest";
import { diasDelRango, esPeriodo, rangoDe, textoRango } from "./periodos";

const HOY = "2026-10-23";

describe("rangoDe", () => {
  it("calcula cada periodo hasta hoy, incluido el día de hoy", () => {
    expect(rangoDe("7", HOY)).toEqual({ desde: "2026-10-17", hasta: HOY });
    expect(rangoDe("30", HOY)).toEqual({ desde: "2026-09-24", hasta: HOY });
    expect(rangoDe("90", HOY)).toEqual({ desde: "2026-07-26", hasta: HOY });
    expect(rangoDe("mes", HOY)).toEqual({ desde: "2026-10-01", hasta: HOY });
    expect(rangoDe("mes_anterior", HOY)).toEqual({ desde: "2026-09-01", hasta: "2026-09-30" });
    expect(rangoDe("mes_anterior", "2026-01-15")).toEqual({ desde: "2025-12-01", hasta: "2025-12-31" });
    expect(rangoDe("12m", HOY)).toEqual({ desde: "2025-10-23", hasta: HOY });
  });

  it("los días coinciden con los límites de la API (90 cabe en 92; 12 meses son 366)", () => {
    expect(diasDelRango(rangoDe("7", HOY))).toBe(7);
    expect(diasDelRango(rangoDe("30", HOY))).toBe(30);
    expect(diasDelRango(rangoDe("90", HOY))).toBe(90);
    expect(diasDelRango(rangoDe("12m", HOY))).toBe(366);
  });

  it("personalizado usa las fechas de la URL; si faltan o están al revés, los últimos 30 días", () => {
    expect(rangoDe("personalizado", HOY, { desde: "2026-08-01", hasta: "2026-08-31" })).toEqual({
      desde: "2026-08-01",
      hasta: "2026-08-31",
    });
    expect(rangoDe("personalizado", HOY, { desde: "2026-09-01", hasta: "2026-08-01" })).toEqual(
      rangoDe("30", HOY),
    );
    expect(rangoDe("personalizado", HOY, {})).toEqual(rangoDe("30", HOY));
  });
});

describe("textos", () => {
  it("rango corto y con año si cruza de año", () => {
    expect(textoRango({ desde: "2026-08-27", hasta: "2026-09-25" })).toBe("27 ago – 25 sep");
    expect(textoRango({ desde: "2025-10-23", hasta: "2026-10-23" })).toBe("23 oct 2025 – 23 oct 2026");
    expect(textoRango({ desde: HOY, hasta: HOY })).toBe("23 oct");
  });

  it("solo acepta periodos conocidos de la URL", () => {
    expect(esPeriodo("90")).toBe(true);
    expect(esPeriodo("365")).toBe(false);
    expect(esPeriodo(null)).toBe(false);
  });
});
