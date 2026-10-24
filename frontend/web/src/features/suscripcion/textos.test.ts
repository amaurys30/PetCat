import { describe, expect, it } from "vitest";
import { planesDemo, suscripcionDemo, suscripcionEnPrueba } from "@/test/suscripcion";
import { avisoVencida, enlaceContratar, enlaceWhatsapp, lineaVencimiento, ventajasPlan } from "./textos";

const [gratuito, pro, enterprise] = planesDemo as [
  (typeof planesDemo)[0],
  (typeof planesDemo)[0],
  (typeof planesDemo)[0],
];

describe("ventajasPlan", () => {
  it("arma lo que incluye cada plan con sus límites y, desde el segundo, solo lo nuevo", () => {
    expect(ventajasPlan(gratuito)).toEqual([
      "1 sede · 3 empleados",
      "30 citas al mes",
      "50 productos",
      "Dashboard básico",
    ]);
    expect(ventajasPlan(pro, gratuito)).toEqual([
      "Todo lo de Gratuito",
      "3 sedes",
      "Citas, empleados y productos ilimitados",
      "Estadísticas avanzadas y 12 meses de historia",
      "Soporte prioritario",
    ]);
    expect(ventajasPlan(enterprise, pro)).toEqual([
      "Todo lo de Pro",
      "Sedes ilimitadas",
      "Recomendaciones con IA",
      "Acceso a la API",
      "Gestor de cuenta dedicado",
    ]);
  });
});

describe("lineaVencimiento", () => {
  it("Gratuito sin vencimiento, prueba con su fin y plan pago con su precio", () => {
    expect(lineaVencimiento(suscripcionDemo())).toMatch(/^Sin vencimiento · \$\s0$/);
    expect(lineaVencimiento(suscripcionEnPrueba())).toBe("Prueba gratis hasta el 6 nov 2026");
    const pago = suscripcionEnPrueba();
    pago.suscripcion = {
      ...pago.suscripcion!,
      estado: "activa",
      fecha_prueba_fin: null,
      fecha_fin: "2026-11-25",
    };
    expect(lineaVencimiento(pago)).toMatch(/^Vence el 25 nov 2026 · \$\s120\.000\/mes$/);
    pago.suscripcion.tipo_facturacion = "anual";
    expect(lineaVencimiento(pago)).toMatch(/\$\s1\.080\.000\/año$/);
  });
});

describe("avisoVencida", () => {
  it("distingue la prueba terminada del plan pago vencido; vigente, null", () => {
    expect(avisoVencida(suscripcionDemo())).toBeNull();
    const prueba = suscripcionEnPrueba();
    prueba.plan = gratuito;
    prueba.suscripcion = { ...prueba.suscripcion!, estado: "vencida" };
    expect(avisoVencida(prueba)).toBe(
      "Tu prueba del plan Pro terminó el 6 nov 2026. Volviste al plan Gratuito: no se desactivó nada, pero ahora aplican sus límites.",
    );
    prueba.suscripcion.fecha_prueba_fin = null;
    expect(avisoVencida(prueba)).toMatch(/^Tu plan Pro venció el 6 nov 2026\./);
  });
});

describe("contacto", () => {
  it("WhatsApp con solo los dígitos; contratar por correo, si no por WhatsApp, si no null", () => {
    expect(enlaceWhatsapp("+57 300 123 4567")).toBe("https://wa.me/573001234567");
    expect(enlaceContratar({ email: "a@b.co", whatsapp: "+57 300" }, "Plan Pro")).toBe(
      "mailto:a@b.co?subject=Plan%20Pro",
    );
    expect(enlaceContratar({ email: null, whatsapp: "+57 300" }, "Plan Pro")).toBe(
      "https://wa.me/57300?text=Plan%20Pro",
    );
    expect(enlaceContratar({ email: null, whatsapp: null }, "Plan Pro")).toBeNull();
  });
});
