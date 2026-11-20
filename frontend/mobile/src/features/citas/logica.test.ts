import { ApiError } from "@/api/errors";

import { citaDemo, horariosDemo } from "../../../test/msw/handlers";
import {
  agruparCitas,
  agruparHorarios,
  cancelacionTardia,
  diasParaAgendar,
  errorDeReserva,
  etiquetaCita,
  fechaParaLeer,
  fechaYHora,
  grupoDeCita,
  horaCorta,
  inicioCita,
  motivoNoAtiende,
  puedeCancelar,
  puedeReprogramar,
  sumarDias,
  textoEstado,
} from "./logica";

// 18 nov 2026, 8:30 a. m. en Bogotá = 13:30 UTC.
const INICIO = Date.UTC(2026, 10, 18, 13, 30);
const HORA = 60 * 60 * 1000;

describe("días para agendar", () => {
  it("suma días cruzando meses y años", () => {
    expect(sumarDias("2026-11-30", 1)).toBe("2026-12-01");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("14 días desde hoy; cerrados los que la sede no abre", () => {
    const horarios = [1, 2, 3, 4, 5].map((d) => ({
      dia_semana: d,
      hora_apertura: "08:00",
      hora_cierre: "12:00",
    }));
    const dias = diasParaAgendar("2026-11-20", horarios);
    expect(dias).toHaveLength(14);
    expect(dias[0]).toEqual({ fecha: "2026-11-20", diaSemana: 5, dia: 20, mes: 11, abierto: true });
    // Sábado y domingo cerrados.
    expect(dias.slice(1, 3).map((d) => d.abierto)).toEqual([false, false]);
    expect(dias[13]!.fecha).toBe("2026-12-03");
  });

  it("fecha para leer", () => {
    expect(fechaParaLeer("2026-11-18")).toBe("miércoles 18 de noviembre");
    expect(fechaYHora("2026-11-18", "08:30")).toBe("Mié 18 nov · 8:30 a. m.");
  });
});

describe("horas", () => {
  it("agrupa en mañana, tarde y noche, sin grupos vacíos", () => {
    const grupos = agruparHorarios(horariosDemo("2026-11-18", ["08:00", "11:45", "12:00", "17:45"]).horarios);
    expect(grupos.map((g) => [g.titulo, g.horarios.map((h) => h.hora_inicio)])).toEqual([
      ["Mañana", ["08:00", "11:45"]],
      ["Tarde", ["12:00", "17:45"]],
    ]);
    expect(agruparHorarios(horariosDemo("2026-11-18", ["18:00"]).horarios)[0]!.titulo).toBe("Noche");
  });

  it("hora corta sin a. m. ni p. m.", () => {
    expect(horaCorta("08:30")).toBe("8:30");
    expect(horaCorta("14:00")).toBe("2:00");
  });
});

describe("mascota y servicio", () => {
  it("atiende por especie o con todos", () => {
    expect(motivoNoAtiende("perro", ["perro", "gato"])).toBeNull();
    expect(motivoNoAtiende("gato", ["todos"])).toBeNull();
    expect(motivoNoAtiende("gato", ["perro"])).toBe("Este servicio no atiende gatos");
    expect(motivoNoAtiende("otro", ["perro"])).toBe("Este servicio no atiende esta especie");
  });
});

describe("reglas de la cita", () => {
  it("inicio en hora de Bogotá, sin depender de la zona del equipo", () => {
    expect(inicioCita({ fecha: "2026-11-18", hora_inicio: "08:30" })).toBe(INICIO);
  });

  it("cancelar hasta que empiece; tardía con menos de 2 horas", () => {
    const c = citaDemo();
    expect(puedeCancelar(c, INICIO - 1)).toBe(true);
    expect(puedeCancelar(c, INICIO)).toBe(false);
    expect(puedeCancelar(citaDemo({ estado: "completada" }), INICIO - 10 * HORA)).toBe(false);
    expect(cancelacionTardia(c, INICIO - 2 * HORA)).toBe(false);
    expect(cancelacionTardia(c, INICIO - 2 * HORA + 1)).toBe(true);
  });

  it("reprogramar hasta 2 horas antes", () => {
    const c = citaDemo({ estado: "confirmada" });
    expect(puedeReprogramar(c, INICIO - 2 * HORA)).toBe(true);
    expect(puedeReprogramar(c, INICIO - 2 * HORA + 1)).toBe(false);
    expect(puedeReprogramar(citaDemo({ estado: "cancelada" }), INICIO - 10 * HORA)).toBe(false);
  });

  it("estado en texto y etiqueta para el lector", () => {
    expect(textoEstado("no_asistio")).toBe("No asististe");
    expect(etiquetaCita(citaDemo())).toBe(
      "Consulta general para Luna. miércoles 18 de noviembre a las 8:30 a. m. en Clínica Vet Sabanas, Principal. Pendiente.",
    );
  });
});

describe("agrupar mis citas", () => {
  it("esta semana (de lunes a domingo) y después por mes, con el año si cambia", () => {
    // Hoy: viernes 20 nov 2026. La semana va del lunes 16 al domingo 22.
    expect(grupoDeCita("2026-11-16", "2026-11-20")).toBe("Esta semana");
    expect(grupoDeCita("2026-11-22", "2026-11-20")).toBe("Esta semana");
    expect(grupoDeCita("2026-11-23", "2026-11-20")).toBe("Noviembre");
    expect(grupoDeCita("2026-12-04", "2026-11-20")).toBe("Diciembre");
    expect(grupoDeCita("2027-01-08", "2026-11-20")).toBe("Enero 2027");
  });

  it("respeta el orden de la API", () => {
    const grupos = agruparCitas(
      [
        citaDemo({ id_cita: 1, fecha: "2026-11-21" }),
        citaDemo({ id_cita: 2, fecha: "2026-11-25" }),
        citaDemo({ id_cita: 3, fecha: "2026-11-28" }),
        citaDemo({ id_cita: 4, fecha: "2026-12-02" }),
      ],
      "2026-11-20",
    );
    expect(grupos.map((g) => [g.titulo, g.citas.map((c) => c.id_cita)])).toEqual([
      ["Esta semana", [1]],
      ["Noviembre", [2, 3]],
      ["Diciembre", [4]],
    ]);
  });
});

describe("errores al reservar", () => {
  it("409 de horario ocupado: mensaje claro y recargar las horas", () => {
    expect(errorDeReserva(new ApiError(409, "El horario ya no está disponible: elige otro"))).toEqual({
      mensaje: "Esa hora se acaba de ocupar. Elige otra de las horas libres.",
      recargarHoras: true,
      campoMascota: false,
    });
  });

  it("otro 409: el mensaje de la API, y también recarga", () => {
    const e = errorDeReserva(new ApiError(409, "La mascota ya tiene otra cita a esa hora"));
    expect(e).toEqual({
      mensaje: "La mascota ya tiene otra cita a esa hora",
      recargarHoras: true,
      campoMascota: false,
    });
  });

  it("422 de la mascota: junto a la mascota", () => {
    const e = errorDeReserva(
      new ApiError(422, "Revisa los datos", "http", {
        id_mascota: "El servicio no atiende mascotas de ese peso",
      }),
    );
    expect(e).toEqual({
      mensaje: "El servicio no atiende mascotas de ese peso",
      recargarHoras: false,
      campoMascota: true,
    });
  });

  it("sin respuesta: no sabemos si quedó; revisar Mis citas", () => {
    expect(errorDeReserva(new ApiError(0, "Sin conexión", "red")).mensaje).toMatch(/Revisa Mis citas/);
  });
});
