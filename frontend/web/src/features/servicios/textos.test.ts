import { describe, expect, it } from "vitest";
import { estadoOferta, sinSaltos, textoDuracion, textoEspecies, textoMinutos, textoPrecio } from "./textos";

describe("textos de servicios", () => {
  it("textoEspecies", () => {
    expect(textoEspecies(["todos"])).toBe("Todas las especies");
    expect(textoEspecies(["perro"])).toBe("Solo perros");
    expect(textoEspecies(["gato", "perro"])).toBe("Perros y gatos");
    expect(textoEspecies(["perro", "gato", "ave"])).toBe("Perros, gatos y aves");
    expect(textoEspecies(["perro", "gato", "ave", "conejo"])).toBe("4 especies");
  });

  it("textoMinutos y textoDuracion", () => {
    expect(textoMinutos(30)).toBe("30 min");
    expect(textoMinutos(90)).toBe("90 min");
    expect(textoMinutos(120)).toBe("2 h");
    expect(textoMinutos(150)).toBe("2 h 30 min");
    expect(textoMinutos(1440)).toBe("Todo el día");
    expect(textoDuracion(60, 15)).toBe("60 min + 15 de margen");
    expect(textoDuracion(60, 0)).toBe("60 min");
  });

  it("textoPrecio según el tipo", () => {
    const nb = (t: string) => t.replace(/\s/g, " ");
    expect(nb(textoPrecio({ precio: 45000, precio_maximo: null, tipo_precio: "fijo" }))).toBe("$ 45.000");
    expect(nb(textoPrecio({ precio: 45000, precio_maximo: null, tipo_precio: "variable" }))).toBe(
      "Desde $ 45.000",
    );
    expect(nb(textoPrecio({ precio: 45000, precio_maximo: 60000, tipo_precio: "variable" }))).toBe(
      "$ 45.000 – $ 60.000",
    );
    expect(nb(textoPrecio({ precio: 20000, precio_maximo: null, tipo_precio: "por_hora" }))).toBe(
      "$ 20.000 / hora",
    );
    expect(nb(textoPrecio({ precio: 40000, precio_maximo: null, tipo_precio: "por_dia" }))).toBe(
      "$ 40.000 / día",
    );
  });

  it("estadoOferta", () => {
    const base = {
      en_oferta: true,
      oferta_vigente: false,
      fecha_inicio_oferta: null,
      fecha_fin_oferta: null,
    };
    const hoy = "2026-10-04";
    expect(estadoOferta({ ...base, en_oferta: false }, hoy)).toBeNull();
    expect(estadoOferta({ ...base, oferta_vigente: true }, hoy)).toBe("vigente");
    expect(
      estadoOferta({ ...base, fecha_inicio_oferta: "2026-10-10", fecha_fin_oferta: "2026-10-20" }, hoy),
    ).toBe("programada");
    expect(
      estadoOferta({ ...base, fecha_inicio_oferta: "2026-09-01", fecha_fin_oferta: "2026-10-03" }, hoy),
    ).toBe("vencida");
  });

  it("sinSaltos une las líneas con un espacio", () => {
    expect(sinSaltos("Ayuno de 8 horas.\nTrae el carnet.\r\n\nGracias")).toBe(
      "Ayuno de 8 horas. Trae el carnet. Gracias",
    );
  });
});
