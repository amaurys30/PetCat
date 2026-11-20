import { colors } from "./tokens";

type Token = keyof typeof colors;

/** Razón de contraste WCAG 2.x entre dos colores hex. */
function contraste(a: string, b: string): number {
  const luminancia = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro! + 0.05) / (oscuro! + 0.05);
}

const BLANCO = "#FFFFFF";

// Pares de texto de M2 y M3 (texto normal: AA pide 4,5:1).
const PARES: [string, Token | typeof BLANCO, Token][] = [
  ["texto blanco en el degradado del héroe y la ficha (inicio)", BLANCO, "primary-strong"],
  ["texto blanco en el degradado del héroe y la ficha (final)", BLANCO, "primary-deep"],
  ["tarjeta de gato (inicio del degradado)", BLANCO, "lavender-ink"],
  ["tarjeta de otras especies (inicio del degradado)", BLANCO, "coral-dark"],
  ["final de los degradados de gato y otras especies", BLANCO, "passport-to"],
  ["chip Vacuna próxima", "sun-ink", "sun-soft"],
  ["chip informativo", "info-ink", "info-soft"],
  ["chip coral", "coral-dark", "coral-soft"],
  ["chip En memoria", "lavender-ink", "lavender-soft"],
  ["tendencia del peso", "primary-deep", "primary-soft"],
  ["aviso sin conexión", "danger-ink", "danger-soft"],
  // M3 · Pasaporte: tarjeta (los dos extremos del degradado) y fondo oscuro de la pantalla.
  ...(["pasaporte-carta-from", "pasaporte-carta-to"] as const).flatMap((fondo) => [
    [`tarjeta: nombre y datos sobre ${fondo}`, BLANCO, fondo] as [string, typeof BLANCO, Token],
    [`tarjeta: rótulos sobre ${fondo}`, "pasaporte-rotulo", fondo] as [string, Token, Token],
    [`tarjeta: número de pasaporte sobre ${fondo}`, "pasaporte-numero", fondo] as [string, Token, Token],
  ]),
  ...(["pasaporte-memoria-from", "pasaporte-memoria-to"] as const).flatMap((fondo) => [
    [`tarjeta «En memoria»: datos sobre ${fondo}`, BLANCO, fondo] as [string, typeof BLANCO, Token],
    [`tarjeta «En memoria»: rótulos sobre ${fondo}`, "pasaporte-memoria-rotulo", fondo] as [
      string,
      Token,
      Token,
    ],
  ]),
  ["chip «En memoria» de la tarjeta", "lavender-ink", "white"],
  ...(["passport-from", "passport-to", "pasaporte-panel"] as const).flatMap((fondo) =>
    (
      [
        BLANCO,
        "oscuro-muted",
        "sello-teal",
        "sello-coral",
        "sello-lavender",
        "sello-info",
        "sello-sun",
        "sello-danger",
        "sello-memoria",
      ] as const
    ).map(
      (texto) =>
        [`pantalla oscura: ${texto} sobre ${fondo}`, texto, fondo] as [string, Token | typeof BLANCO, Token],
    ),
  ),
  // Línea de vida (M8), sobre fondo claro.
  ["insignia Pendiente", "sun-ink", "sun-soft"],
  ["insignia Atendida", "info-ink", "info-soft"],
  ["insignia Aplicada", "primary-deep", "primary-soft"],
  ["insignia Vencida", "danger-ink", "danger-soft"],
  ["ícono de desparasitación", "lavender-ink", "lavender-soft"],
  // M4 · Explorar: pines del mapa y estado de apertura.
  ["pin seleccionado (calificación sobre coral)", "coral-ink", "coral"],
  ["pin: calificación sobre blanco", "ink", "white"],
  ["chip Abierto", "primary-deep", "primary-soft"],
  ["chip Cerrado", "muted", "track"],
  ["enlace Mostrando Sincelejo", "primary-strong", "surface"],
];

const valor = (t: string) => (t.startsWith("#") ? t : colors[t as Token]);

describe("contraste AA de los colores de M2 y M3", () => {
  it.each(PARES)("%s", (_nombre, texto, fondo) => {
    expect(contraste(valor(texto), valor(fondo))).toBeGreaterThanOrEqual(4.5);
  });

  it("la fórmula da los valores conocidos", () => {
    expect(contraste("#000000", BLANCO)).toBeCloseTo(21, 0);
    // primary (#14A39A) no llega a AA con texto blanco: por eso nunca se usa así.
    expect(contraste(BLANCO, colors.primary)).toBeLessThan(4.5);
  });
});
