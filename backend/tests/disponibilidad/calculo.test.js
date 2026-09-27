import { describe, expect, it } from "vitest";
import {
  calcularDisponibilidad,
  citaCabe,
  comoHoras,
  diaSemana,
  normalizar,
  resta,
} from "../../src/modules/disponibilidad/disponibilidad.calculo.js";

// 2026-10-05 es lunes (1); 2026-10-04, domingo (0).
const LUNES = "2026-10-05";
const DOMINGO = "2026-10-04";
const S1 = 1;
const S2 = 2;

// Sucursal con horario partido de lunes a sábado y cerrada el domingo.
const horarioSucursal = [1, 2, 3, 4, 5, 6].flatMap((dia_semana) => [
  { dia_semana, hora_apertura: "08:00", hora_cierre: "12:00" },
  { dia_semana, hora_apertura: "14:00", hora_cierre: "18:00" },
]);

const normal = (dia_semana, hora_inicio, hora_fin, id_sucursal = null) => ({ dia_semana, hora_inicio, hora_fin, id_sucursal });
const evento = (fecha, hora_inicio, hora_fin, id_sucursal = S1) => ({
  tipo: "evento_especial",
  fecha_especifica: fecha,
  fecha_fin: null,
  hora_inicio,
  hora_fin,
  id_sucursal,
});
const bloqueo = (fecha_especifica, { fecha_fin = null, hora_inicio = null, hora_fin = null } = {}) => ({
  tipo: "bloqueo",
  fecha_especifica,
  fecha_fin,
  hora_inicio,
  hora_fin,
  id_sucursal: null,
});
const vacacion = (fecha_especifica, fecha_fin = null) => ({ tipo: "vacacion", fecha_especifica, fecha_fin, id_sucursal: null });

const calcular = ({ fecha = LUNES, id_sucursal = S1, semanal = [], excepciones = [], sucursal = horarioSucursal } = {}) =>
  comoHoras(calcularDisponibilidad({ fecha, id_sucursal, horarioSucursal: sucursal, horarioSemanal: semanal, excepciones }));

describe("operaciones con rangos", () => {
  it("normalizar ordena y une rangos que se cruzan o se tocan", () => {
    expect(normalizar([{ inicio: 600, fin: 720 }, { inicio: 480, fin: 600 }, { inicio: 900, fin: 960 }])).toEqual([
      { inicio: 480, fin: 720 },
      { inicio: 900, fin: 960 },
    ]);
  });

  it("resta parte un rango en dos", () => {
    expect(resta([{ inicio: 480, fin: 720 }], [{ inicio: 540, fin: 600 }])).toEqual([
      { inicio: 480, fin: 540 },
      { inicio: 600, fin: 720 },
    ]);
  });

  it("diaSemana no depende de la zona horaria", () => {
    expect(diaSemana(LUNES)).toBe(1);
    expect(diaSemana(DOMINGO)).toBe(0);
  });
});

describe("calcularDisponibilidad", () => {
  it("un veterinario que trabaja de 8 a 12 y agrega una jornada de 14 a 17 conserva la mañana", () => {
    const disponibilidad = calcular({
      semanal: [normal(1, "08:00", "12:00")],
      excepciones: [evento(LUNES, "14:00", "17:00")],
    });
    expect(disponibilidad).toEqual([
      { hora_inicio: "08:00", hora_fin: "12:00" },
      { hora_inicio: "14:00", hora_fin: "17:00" },
    ]);
  });

  it("sin horario semanal sigue el horario de la sucursal", () => {
    expect(calcular()).toEqual([
      { hora_inicio: "08:00", hora_fin: "12:00" },
      { hora_inicio: "14:00", hora_fin: "18:00" },
    ]);
  });

  it("con horario semanal, un día sin rangos no está disponible", () => {
    expect(calcular({ semanal: [normal(2, "08:00", "12:00")] })).toEqual([]);
  });

  it("el horario normal se recorta por el horario de la sucursal (no cruza el cierre del mediodía)", () => {
    expect(calcular({ semanal: [normal(1, "07:00", "16:00")] })).toEqual([
      { hora_inicio: "08:00", hora_fin: "12:00" },
      { hora_inicio: "14:00", hora_fin: "16:00" },
    ]);
  });

  it("cuenta los rangos de esta sucursal y los que no tienen sucursal, no los de otra", () => {
    const semanal = [normal(1, "08:00", "10:00", S1), normal(1, "10:00", "11:00", null), normal(1, "14:00", "18:00", S2)];
    expect(calcular({ semanal })).toEqual([{ hora_inicio: "08:00", hora_fin: "11:00" }]);
    expect(calcular({ semanal, id_sucursal: S2 })).toEqual([
      { hora_inicio: "10:00", hora_fin: "11:00" },
      { hora_inicio: "14:00", hora_fin: "18:00" },
    ]);
  });

  it("el evento se suma sin recortarlo por el horario de la sucursal (jornada un domingo)", () => {
    expect(calcular({ fecha: DOMINGO, excepciones: [evento(DOMINGO, "09:00", "13:00")] })).toEqual([
      { hora_inicio: "09:00", hora_fin: "13:00" },
    ]);
    // También se suma al horario de la sucursal cuando el empleado no tiene horario semanal.
    expect(calcular({ excepciones: [evento(LUNES, "12:00", "14:00")] })).toEqual([{ hora_inicio: "08:00", hora_fin: "18:00" }]);
  });

  it("un evento en otra sucursal manda en ese rango: se resta de esta", () => {
    const excepciones = [evento(LUNES, "10:00", "15:00", S2)];
    expect(calcular({ semanal: [normal(1, "08:00", "18:00")], excepciones })).toEqual([
      { hora_inicio: "08:00", hora_fin: "10:00" },
      { hora_inicio: "15:00", hora_fin: "18:00" },
    ]);
    expect(calcular({ semanal: [normal(1, "08:00", "18:00")], excepciones, id_sucursal: S2 })).toEqual([
      { hora_inicio: "08:00", hora_fin: "18:00" },
    ]);
  });

  it("un bloqueo con horas sobre el horario normal más un evento reemplaza el día", () => {
    const disponibilidad = calcular({
      semanal: [normal(1, "08:00", "12:00")],
      excepciones: [bloqueo(LUNES, { hora_inicio: "08:00", hora_fin: "12:00" }), evento(LUNES, "14:00", "17:00")],
    });
    expect(disponibilidad).toEqual([{ hora_inicio: "14:00", hora_fin: "17:00" }]);
  });

  it("bloqueos y vacaciones restan también sobre los eventos; sin horas cubren el día completo", () => {
    const eventoTarde = evento(LUNES, "14:00", "17:00");
    expect(calcular({ excepciones: [eventoTarde, bloqueo(LUNES)] })).toEqual([]);
    expect(calcular({ excepciones: [eventoTarde, bloqueo(LUNES, { hora_inicio: "15:00", hora_fin: "16:00" })] })).toEqual([
      { hora_inicio: "08:00", hora_fin: "12:00" },
      { hora_inicio: "14:00", hora_fin: "15:00" },
      { hora_inicio: "16:00", hora_fin: "18:00" },
    ]);
    expect(calcular({ excepciones: [eventoTarde, vacacion("2026-10-01", "2026-10-10")] })).toEqual([]);
  });

  it("un bloqueo de varios días con horas aplica ese rango cada día; las excepciones de otras fechas no cuentan", () => {
    const excepciones = [
      bloqueo("2026-10-01", { fecha_fin: "2026-10-09", hora_inicio: "08:00", hora_fin: "09:00" }),
      vacacion("2026-10-06", "2026-10-09"),
      evento("2026-10-06", "19:00", "20:00"),
    ];
    expect(calcular({ excepciones })).toEqual([
      { hora_inicio: "09:00", hora_fin: "12:00" },
      { hora_inicio: "14:00", hora_fin: "18:00" },
    ]);
  });
});

describe("citaCabe", () => {
  const datos = (excepciones = []) => ({
    horariosPorSucursal: { [S1]: horarioSucursal },
    horarioSemanal: [normal(1, "08:00", "12:00")],
    excepciones,
  });
  const cita = (hora_inicio, hora_fin, id_sucursal = S1) => ({ fecha: LUNES, hora_inicio, hora_fin, id_sucursal });

  it("cabe dentro de un rango; no si cruza el borde o cae en un bloqueo", () => {
    expect(citaCabe(cita("09:00:00", "09:30:00"), datos())).toBe(true);
    expect(citaCabe(cita("11:45:00", "12:15:00"), datos())).toBe(false);
    expect(citaCabe(cita("15:00:00", "15:30:00"), datos())).toBe(false);
    expect(citaCabe(cita("09:00:00", "09:30:00"), datos([bloqueo(LUNES, { hora_inicio: "09:15", hora_fin: "10:00" })]))).toBe(false);
  });

  it("en una sucursal sin horario cargado no cabe; sin sucursal solo cuentan bloqueos y vacaciones", () => {
    expect(citaCabe(cita("09:00:00", "09:30:00", 99), datos())).toBe(false);
    expect(citaCabe(cita("20:00:00", "20:30:00", null), datos())).toBe(true);
    expect(citaCabe(cita("20:00:00", "20:30:00", null), datos([vacacion(LUNES)]))).toBe(false);
  });
});
