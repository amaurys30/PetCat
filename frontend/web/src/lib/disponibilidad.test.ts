import { describe, expect, it } from "vitest";
import {
  erroresSemanaProfesional,
  semanaDesdeSede,
  semanaProfesionalAApi,
  semanaProfesionalDesdeApi,
  semanasProfesionalIguales,
} from "./disponibilidad";

describe("horario semanal del profesional", () => {
  it("convierte desde y hacia la API, con la sede de cada rango y las posiciones", () => {
    const semana = semanaProfesionalDesdeApi([
      { dia_semana: 1, hora_inicio: "14:00:00", hora_fin: "18:00:00", id_sucursal: 2 },
      { dia_semana: 1, hora_inicio: "08:00", hora_fin: "12:00", id_sucursal: null },
    ]);
    expect(semana[1]).toEqual([
      { inicio: "08:00", fin: "12:00", id_sucursal: null },
      { inicio: "14:00", fin: "18:00", id_sucursal: 2 },
    ]);
    const { horarios, posiciones } = semanaProfesionalAApi(semana);
    expect(horarios).toEqual([
      { dia_semana: 1, hora_inicio: "08:00", hora_fin: "12:00", id_sucursal: null },
      { dia_semana: 1, hora_inicio: "14:00", hora_fin: "18:00", id_sucursal: 2 },
    ]);
    expect(posiciones).toEqual([
      { dia: 1, indice: 0 },
      { dia: 1, indice: 1 },
    ]);
  });

  it("los rangos de un día no se cruzan aunque sean de sedes distintas; tocarse sí", () => {
    const semana = semanaProfesionalDesdeApi([
      { dia_semana: 2, hora_inicio: "08:00", hora_fin: "12:00", id_sucursal: 1 },
      { dia_semana: 2, hora_inicio: "11:00", hora_fin: "13:00", id_sucursal: 2 },
      { dia_semana: 3, hora_inicio: "08:00", hora_fin: "12:00", id_sucursal: 1 },
      { dia_semana: 3, hora_inicio: "12:00", hora_fin: "14:00", id_sucursal: 2 },
      { dia_semana: 4, hora_inicio: "10:00", hora_fin: "09:00", id_sucursal: null },
    ]);
    const errores = erroresSemanaProfesional(semana);
    expect(errores["2-0"]).toBe("Se cruza con 11:00–13:00");
    expect(errores["2-1"]).toBe("Se cruza con 08:00–12:00");
    expect(errores["3-0"]).toBeUndefined();
    expect(errores["4-0"]).toBe("La hora de fin debe ser posterior a la de inicio");
  });

  it("compara semanas sin importar el orden y teniendo en cuenta la sede", () => {
    const a = semanaProfesionalDesdeApi([
      { dia_semana: 1, hora_inicio: "08:00", hora_fin: "12:00", id_sucursal: 1 },
    ]);
    const b = semanaProfesionalDesdeApi([
      { dia_semana: 1, hora_inicio: "08:00", hora_fin: "12:00", id_sucursal: 2 },
    ]);
    expect(semanasProfesionalIguales(a, a)).toBe(true);
    expect(semanasProfesionalIguales(a, b)).toBe(false);
  });

  it("parte del horario de una sede", () => {
    const semana = semanaDesdeSede([{ dia_semana: 6, hora_apertura: "08:00", hora_cierre: "12:00" }], 3);
    expect(semana[6]).toEqual([{ inicio: "08:00", fin: "12:00", id_sucursal: 3 }]);
  });
});
