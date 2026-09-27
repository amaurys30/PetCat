import { describe, expect, it } from "vitest";
import { alCuadricula, combinarHorarios, iniciosLibres } from "../../src/modules/citas/citas.calculo.js";
import { aHora, aMinutos } from "../../src/modules/disponibilidad/disponibilidad.calculo.js";

const rango = (inicio, fin) => ({ inicio: aMinutos(inicio), fin: aMinutos(fin) });
const horas = (inicios) => inicios.map(aHora);

const base = { ocupados: [], duracion: 30, margen: 0, intervalo: 15 };

describe("iniciosLibres", () => {
  it("recorre la cuadrícula de 15 minutos y la cita debe caber entera en el rango", () => {
    const inicios = iniciosLibres({ ...base, rangos: [rango("08:00", "09:00"), rango("14:00", "14:45")] });
    expect(horas(inicios)).toEqual(["08:00", "08:15", "08:30", "14:00", "14:15"]);
  });

  it("los candidatos son de la cuadrícula aunque el rango o la duración no lo sean", () => {
    const inicios = iniciosLibres({ ...base, duracion: 10, rangos: [rango("08:05", "08:50")] });
    expect(horas(inicios)).toEqual(["08:15", "08:30"]);
  });

  it("respeta el primer minuto permitido (antelación de hoy)", () => {
    const inicios = iniciosLibres({ ...base, rangos: [rango("08:00", "10:00")], desde: aMinutos("08:40") });
    expect(horas(inicios)).toEqual(["08:45", "09:00", "09:15", "09:30"]);
  });

  it("no se cruza con otras citas contando el margen de cada una", () => {
    // Cita existente 09:00–09:30 con 15 min de margen: ocupa hasta 09:45.
    const ocupados = [{ inicio: aMinutos("09:00"), fin: aMinutos("09:45") }];
    const sinMargen = iniciosLibres({ ...base, ocupados, rangos: [rango("08:00", "10:30")] });
    expect(horas(sinMargen)).toEqual(["08:00", "08:15", "08:30", "09:45", "10:00"]);

    // La cita nueva con 15 min de margen ocupa [t, t + 45): 08:30 ya chocaría.
    const conMargen = iniciosLibres({ ...base, margen: 15, ocupados, rangos: [rango("08:00", "10:30")] });
    expect(horas(conMargen)).toEqual(["08:00", "08:15", "09:45", "10:00"]);
  });

  it("el margen no necesita caber en la disponibilidad", () => {
    const inicios = iniciosLibres({ ...base, margen: 15, rangos: [rango("11:00", "12:00")] });
    expect(horas(inicios)).toEqual(["11:00", "11:15", "11:30"]);
  });

  it("alCuadricula redondea hacia arriba", () => {
    expect(alCuadricula(480, 15)).toBe(480);
    expect(alCuadricula(481, 15)).toBe(495);
  });
});

describe("combinarHorarios", () => {
  it("un horario por inicio con los empleados que pueden atenderlo", () => {
    const ana = { id_empleado: 1 };
    const luis = { id_empleado: 2 };
    const horarios = combinarHorarios(
      [
        { empleado: ana, inicios: [480, 495] },
        { empleado: luis, inicios: [495, 510] },
      ],
      30
    );
    expect(horarios).toEqual([
      { inicio: 480, fin: 510, empleados: [ana] },
      { inicio: 495, fin: 525, empleados: [ana, luis] },
      { inicio: 510, fin: 540, empleados: [luis] },
    ]);
  });
});
