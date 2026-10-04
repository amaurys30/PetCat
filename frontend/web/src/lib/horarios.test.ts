import { describe, expect, it } from "vitest";
import {
  agruparDias,
  erroresSemana,
  PLANTILLAS,
  rangoSiguiente,
  seCruzan,
  semanaAApi,
  semanaDesdeApi,
  semanasIguales,
  semanaVacia,
  textoRangos,
} from "./horarios";

const partido = PLANTILLAS[0]!.semana();

describe("horarios", () => {
  it("convierte desde la API ordenando por hora y quitando los segundos", () => {
    const semana = semanaDesdeApi([
      { dia_semana: 1, hora_apertura: "14:00:00", hora_cierre: "18:00:00" },
      { dia_semana: 1, hora_apertura: "08:00:00", hora_cierre: "12:00:00" },
      { dia_semana: 0, hora_apertura: "09:00", hora_cierre: "12:00" },
    ]);
    expect(semana[1]).toEqual([
      { apertura: "08:00", cierre: "12:00" },
      { apertura: "14:00", cierre: "18:00" },
    ]);
    expect(semana[0]).toEqual([{ apertura: "09:00", cierre: "12:00" }]);
    expect(semana[2]).toEqual([]);
  });

  it("convierte a la API y dice a qué día y rango corresponde cada elemento", () => {
    const { horarios, posiciones } = semanaAApi(partido);
    expect(horarios).toHaveLength(10);
    expect(horarios[0]).toEqual({ dia_semana: 1, hora_apertura: "08:00", hora_cierre: "12:00" });
    expect(posiciones[1]).toEqual({ dia: 1, indice: 1 });
    expect(semanasIguales(semanaDesdeApi(horarios), partido)).toBe(true);
  });

  it("los rangos que se tocan no se cruzan", () => {
    expect(seCruzan({ apertura: "08:00", cierre: "12:00" }, { apertura: "12:00", cierre: "14:00" })).toBe(
      false,
    );
    expect(seCruzan({ apertura: "08:00", cierre: "12:00" }, { apertura: "11:45", cierre: "14:00" })).toBe(
      true,
    );
  });

  it("marca cruces y cierres antes de la apertura", () => {
    const semana = semanaVacia();
    semana[1] = [
      { apertura: "08:00", cierre: "12:00" },
      { apertura: "11:00", cierre: "13:00" },
    ];
    semana[2] = [{ apertura: "10:00", cierre: "09:00" }];
    expect(erroresSemana(semana)).toEqual({
      "1-0": "Se cruza con 11:00–13:00",
      "1-1": "Se cruza con 08:00–12:00",
      "2-0": "La hora de cierre debe ser posterior a la de apertura",
    });
    expect(erroresSemana(partido)).toEqual({});
  });

  it("agrupa los días seguidos con el mismo horario", () => {
    const semana = PLANTILLAS[0]!.semana();
    semana[6] = [{ apertura: "08:00", cierre: "12:00" }];
    expect(agruparDias(semana)).toEqual([
      { dias: "Lunes a viernes", horario: "08:00–12:00 · 14:00–18:00" },
      { dias: "Sábado", horario: "08:00–12:00" },
      { dias: "Domingo", horario: "Cerrado" },
    ]);
    expect(agruparDias(PLANTILLAS[1]!.semana()).at(-1)).toEqual({ dias: "Domingo", horario: "Cerrado" });
    expect(agruparDias(partido).at(-1)).toEqual({ dias: "Sábado y domingo", horario: "Cerrado" });
    expect(textoRangos([])).toBe("Cerrado");
  });

  it("propone un rango que no se cruza con los del día", () => {
    expect(rangoSiguiente([])).toEqual({ apertura: "08:00", cierre: "12:00" });
    expect(rangoSiguiente([{ apertura: "08:00", cierre: "12:00" }])).toEqual({
      apertura: "13:00",
      cierre: "17:00",
    });
    expect(rangoSiguiente([{ apertura: "08:00", cierre: "23:59" }])).toBeNull();
  });
});
