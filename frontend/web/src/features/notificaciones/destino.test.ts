import { describe, expect, it } from "vitest";
import { notificacionDemo } from "@/test/notificaciones";
import { destinoDe, esReservaPorConfirmar, haceCuanto, textoContador } from "./destino";

describe("destinoDe", () => {
  it("las citas abren la agenda en su semana con el detalle; sin fecha (avisos viejos), solo el detalle", () => {
    expect(destinoDe(notificacionDemo(), [1])).toEqual({
      tipo: "ruta",
      ruta: "/n/1/agenda?fecha=2026-10-28&cita=77",
      idNegocio: 1,
    });
    const vieja = notificacionDemo({
      tipo: "cita_cancelada",
      datos: { tipo: "cita_cancelada", id_cita: 5, id_negocio: 1 },
    });
    expect(destinoDe(vieja, [1])).toMatchObject({ ruta: "/n/1/agenda?cita=5" });
  });

  it("reseña nueva a la reseña resaltada; avisos del plan a la suscripción, también de otro negocio", () => {
    const resena = notificacionDemo({
      id_negocio: 3,
      tipo: "resena_nueva",
      datos: { tipo: "resena_nueva", id_resena: 9 },
    });
    expect(destinoDe(resena, [1, 3])).toMatchObject({ ruta: "/n/3/resenas?resena=9", idNegocio: 3 });
    const plan = notificacionDemo({
      tipo: "plan_limite_80",
      datos: { tipo: "plan_limite_80", id_negocio: 1, mes: "2026-10" },
    });
    expect(destinoDe(plan, [1])).toMatchObject({ ruta: "/n/1/suscripcion" });
  });

  it("de un negocio al que ya no puede entrar, sin_acceso; un tipo sin pantalla, ninguno", () => {
    expect(destinoDe(notificacionDemo({ id_negocio: 8 }), [1])).toEqual({ tipo: "sin_acceso" });
    const sinPantalla = notificacionDemo({
      tipo: "vacuna_proxima",
      datos: { tipo: "vacuna_proxima", id_mascota: 1 },
    });
    expect(destinoDe(sinPantalla, [1])).toEqual({ tipo: "ninguno" });
  });
});

describe("textos", () => {
  it("hace cuánto, en corto", () => {
    const ahora = new Date(2026, 9, 25, 12, 0, 0);
    expect(haceCuanto("2026-10-25 11:59:30", ahora)).toBe("Ahora");
    expect(haceCuanto("2026-10-25 11:55:00", ahora)).toBe("Hace 5 min");
    expect(haceCuanto("2026-10-25 09:00:00", ahora)).toBe("Hace 3 h");
    expect(haceCuanto("2026-10-23 12:00:00", ahora)).toBe("Hace 2 días");
  });

  it("contador con tope y solo las reservas por confirmar del panel van al sistema operativo", () => {
    expect(textoContador(7)).toBe("7");
    expect(textoContador(120)).toBe("99+");
    expect(esReservaPorConfirmar(notificacionDemo())).toBe(true);
    expect(
      esReservaPorConfirmar(
        notificacionDemo({ datos: { tipo: "cita_nueva", id_cita: 1, por_confirmar: false } }),
      ),
    ).toBe(false);
    expect(esReservaPorConfirmar(notificacionDemo({ destino: "dueno" }))).toBe(false);
    expect(esReservaPorConfirmar(notificacionDemo({ tipo: "cita_cancelada" }))).toBe(false);
  });
});
