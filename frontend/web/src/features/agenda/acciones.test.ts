import { describe, expect, it } from "vitest";
import type { CambioHistorial } from "@/api/citas";
import { accionesDe, autorCambio, tituloCambio } from "./acciones";

// 2026-10-08 10:00 en Bogotá (UTC-5).
const AHORA = new Date("2026-10-08T15:00:00Z");
const todos = { editar: true, cancelar: true };
const activas = (a: ReturnType<typeof accionesDe>) =>
  Object.entries(a)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .sort();

describe("acciones según el estado y la hora", () => {
  it("pendiente: confirmar, rechazar, reprogramar y reasignar", () => {
    expect(
      activas(accionesDe({ estado: "pendiente", fecha: "2026-10-09", hora_inicio: "09:00" }, todos, AHORA)),
    ).toEqual(["confirmar", "reasignar", "rechazar", "reprogramar"]);
  });

  it("confirmada de otro día: sin iniciar ni completar; de hoy antes de empezar: iniciar", () => {
    expect(
      activas(accionesDe({ estado: "confirmada", fecha: "2026-10-09", hora_inicio: "09:00" }, todos, AHORA)),
    ).toEqual(["cancelar", "reasignar", "reprogramar"]);
    expect(
      activas(accionesDe({ estado: "confirmada", fecha: "2026-10-08", hora_inicio: "11:00" }, todos, AHORA)),
    ).toEqual(["cancelar", "iniciar", "reasignar", "reprogramar"]);
  });

  it("confirmada que ya empezó: completar directo, iniciar y no asistió", () => {
    expect(
      activas(accionesDe({ estado: "confirmada", fecha: "2026-10-08", hora_inicio: "09:30" }, todos, AHORA)),
    ).toEqual(["cancelar", "completar", "iniciar", "noAsistio", "reasignar", "reprogramar"]);
  });

  it("en curso: completar; no asistió de hoy: llegó tarde; de ayer: nada", () => {
    expect(
      activas(accionesDe({ estado: "en_curso", fecha: "2026-10-08", hora_inicio: "09:00" }, todos, AHORA)),
    ).toEqual(["completar"]);
    expect(
      activas(accionesDe({ estado: "no_asistio", fecha: "2026-10-08", hora_inicio: "08:00" }, todos, AHORA)),
    ).toEqual(["llegoTarde"]);
    expect(
      activas(accionesDe({ estado: "no_asistio", fecha: "2026-10-07", hora_inicio: "08:00" }, todos, AHORA)),
    ).toEqual([]);
  });

  it("sin citas.editar solo cancela; sin citas.cancelar no rechaza", () => {
    const cita = { estado: "pendiente" as const, fecha: "2026-10-09", hora_inicio: "09:00" };
    expect(activas(accionesDe(cita, { editar: false, cancelar: true }, AHORA))).toEqual(["rechazar"]);
    expect(activas(accionesDe(cita, { editar: true, cancelar: false }, AHORA))).not.toContain("rechazar");
  });
});

describe("historial", () => {
  const cambio = (c: Partial<CambioHistorial>): CambioHistorial => ({
    fecha_cambio: "2026-10-05 09:02:00",
    campo: "estado",
    valor_anterior: null,
    valor_nuevo: "pendiente",
    motivo: null,
    realizado_por: "dueno",
    usuario: { id_usuario: 9, nombre: "Sofía", apellido: "García" },
    empleado: null,
    ...c,
  });

  it("títulos de cada tipo de cambio", () => {
    expect(tituloCambio(cambio({}), "app_movil")).toBe("Creada desde la app · pendiente");
    expect(tituloCambio(cambio({ valor_nuevo: "confirmada" }), "telefono")).toBe(
      "Creada por teléfono · confirmada",
    );
    expect(
      tituloCambio(cambio({ valor_anterior: "pendiente", valor_nuevo: "confirmada" }), "app_movil"),
    ).toBe("Confirmada");
    expect(tituloCambio(cambio({ valor_anterior: "no_asistio", valor_nuevo: "en_curso" }), "app_movil")).toBe(
      "Llegó tarde: en curso",
    );
    expect(
      tituloCambio(
        cambio({ campo: "empleado", valor_anterior: "Carlos Pérez", valor_nuevo: "Paula Rojas" }),
        "app_movil",
      ),
    ).toBe("Profesional: Carlos Pérez → Paula Rojas");
    expect(tituloCambio(cambio({ campo: "precio_final", valor_nuevo: "45000.00" }), "app_movil")).toMatch(
      /45\.000/,
    );
  });

  it("autor: el empleado, el usuario o el sistema", () => {
    expect(autorCambio(cambio({}))).toBe("Sofía García");
    expect(autorCambio(cambio({ empleado: { id_empleado: 1, nombre: "Carlos", apellido: "Pérez" } }))).toBe(
      "Carlos Pérez",
    );
    expect(autorCambio(cambio({ realizado_por: "sistema", usuario: null }))).toBe("Automático");
  });
});
