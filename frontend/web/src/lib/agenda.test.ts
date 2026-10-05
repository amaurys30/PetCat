import { describe, expect, it } from "vitest";
import {
  acomodar,
  aHora,
  aMinutos,
  complemento,
  diasDeSemana,
  encabezadoDia,
  encabezadoGrupo,
  lunesDe,
  tituloDia,
  tituloRango,
  tramosCerrados,
  ventanaVisible,
} from "./agenda";

const t = (inicio: string, fin: string) => ({ inicio: aMinutos(inicio), fin: aMinutos(fin) });

describe("semana y horas", () => {
  it("la semana va de lunes a domingo, también si la fecha es domingo", () => {
    expect(lunesDe("2026-10-07")).toBe("2026-10-05");
    expect(lunesDe("2026-10-11")).toBe("2026-10-05");
    expect(diasDeSemana("2026-10-05")).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
  });

  it("convierte horas y minutos", () => {
    expect(aMinutos("08:30:00")).toBe(510);
    expect(aHora(510)).toBe("08:30");
  });

  it("títulos en español", () => {
    expect(encabezadoDia("2026-10-05")).toBe("Lun 5");
    expect(encabezadoDia("2026-10-07")).toBe("Mié 7");
    expect(tituloDia("2026-10-08")).toBe("Jueves 8 de octubre, 2026");
    expect(tituloRango("2026-09-21", "2026-09-26")).toBe("21 – 26 de septiembre, 2026");
    expect(tituloRango("2026-09-28", "2026-10-03")).toBe("28 sep – 3 oct, 2026");
    expect(tituloRango("2026-12-28", "2027-01-02")).toBe("28 dic 2026 – 2 ene 2027");
    expect(encabezadoGrupo("2026-10-08")).toBe("JUEVES 8 OCT");
  });
});

describe("tramos", () => {
  it("complemento dentro de la ventana", () => {
    expect(complemento([t("08:00", "12:00"), t("14:00", "18:00")], 7 * 60, 19 * 60)).toEqual([
      t("07:00", "08:00"),
      t("12:00", "14:00"),
      t("18:00", "19:00"),
    ]);
  });

  it("la ventana va de la primera apertura a la última hora completa", () => {
    expect(ventanaVisible([t("08:30", "12:00"), t("14:00", "17:45")])).toEqual(t("08:00", "18:00"));
    expect(ventanaVisible([])).toEqual(t("08:00", "18:00"));
  });

  it("etiquetas de cerrado: horario partido, solo mañana, apertura tarde y día cerrado", () => {
    const ventana = t("08:00", "18:00");
    expect(tramosCerrados([t("08:00", "12:00"), t("14:00", "18:00")], ventana)).toEqual([
      { ...t("12:00", "14:00"), etiqueta: "Cerrado 12:00–14:00" },
    ]);
    expect(tramosCerrados([t("08:00", "12:00")], ventana)).toEqual([
      { ...t("12:00", "18:00"), etiqueta: "Cerrado desde las 12:00" },
    ]);
    expect(tramosCerrados([t("09:00", "18:00")], ventana)).toEqual([
      { ...t("08:00", "09:00"), etiqueta: "Abre a las 09:00" },
    ]);
    expect(tramosCerrados([t("08:00", "17:45")], ventana)).toEqual([
      { ...t("17:45", "18:00"), etiqueta: null },
    ]);
    expect(tramosCerrados([], ventana)).toEqual([{ ...ventana, etiqueta: "Cerrado" }]);
  });
});

describe("acomodar citas que se cruzan", () => {
  const citas = [
    { id: "a", ...t("08:00", "08:30") },
    { id: "b", ...t("08:00", "08:15") },
    { id: "c", ...t("08:15", "09:00") },
    { id: "d", ...t("10:00", "10:30") },
  ];
  const colocado = acomodar(citas, (c) => c);
  const de = (id: string) => colocado.find((c) => c.item.id === id)!;

  it("las que se cruzan van lado a lado y reutilizan la columna libre", () => {
    expect([de("a").columna, de("b").columna, de("c").columna]).toEqual([0, 1, 1]);
    expect([de("a").columnas, de("b").columnas, de("c").columnas]).toEqual([2, 2, 2]);
  });

  it("una cita sola ocupa todo el ancho", () => {
    expect(de("d")).toMatchObject({ columna: 0, columnas: 1 });
  });

  it("una cita que toca a otra no se cruza", () => {
    const res = acomodar([t("08:00", "09:00"), t("09:00", "10:00")], (c) => c);
    expect(res.map((c) => c.columnas)).toEqual([1, 1]);
  });
});
