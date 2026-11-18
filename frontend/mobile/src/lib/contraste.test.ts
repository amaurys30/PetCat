import { colors } from "@/theme/tokens";

import { cumpleAA, razonContraste } from "./contraste";

// Pares de texto/fondo que usan los componentes. Si alguien cambia un token y rompe AA, falla.
const PARES_TEXTO: [texto: keyof typeof colors, fondo: keyof typeof colors][] = [
  ["white", "primary-strong"], // botón primario
  ["white", "primary-deep"], // texto sobre el final del degradado de marca
  ["primary-strong", "white"], // botón secundario, enlaces
  ["primary-deep", "primary-soft"], // botón suave, pestaña activa, chips
  ["ink", "white"],
  ["ink", "surface"],
  ["muted", "white"],
  ["muted", "surface"],
  ["muted", "track"], // botón deshabilitado, segmentado inactivo
  ["coral-ink", "coral-from"], // ícono del Carnet sobre el degradado coral
  ["coral-ink", "coral-to"],
  ["coral-dark", "white"], // etiqueta "Carnet"
  ["coral-dark", "coral-soft"],
  ["sun-ink", "sun-soft"],
  ["lavender-ink", "lavender-soft"],
  ["info-ink", "info-soft"],
  ["danger-ink", "white"], // errores de formulario
  ["danger-ink", "danger-soft"], // ErrorState
  ["white", "danger-ink"], // botón de peligro
];

describe("contraste de los tokens", () => {
  it.each(PARES_TEXTO)("%s sobre %s cumple AA (4,5:1)", (texto, fondo) => {
    expect(cumpleAA(colors[texto], colors[fondo])).toBe(true);
  });

  it("texto blanco sobre primary (#14A39A) no cumple: es solo decorativo", () => {
    expect(cumpleAA(colors.white, colors.primary)).toBe(false);
    expect(cumpleAA(colors.white, colors["brand-from"])).toBe(false);
  });

  it("danger como texto no cumple: por eso existe danger-ink", () => {
    expect(cumpleAA(colors.danger, colors.white)).toBe(false);
  });

  it("subtle solo sirve para placeholders, no para información", () => {
    expect(cumpleAA(colors.subtle, colors.white)).toBe(false);
  });

  it("la pista del Toggle apagado llega al 3:1 de los controles", () => {
    expect(cumpleAA(colors.muted, colors.white, { grande: true })).toBe(true);
  });

  it("calcula la razón WCAG", () => {
    expect(razonContraste("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(razonContraste("#0F7D76", "#FFFFFF")).toBeCloseTo(4.98, 1);
    expect(() => razonContraste("blanco", "#000000")).toThrow("Color inválido");
  });
});
