// Los tokens viven en src/theme/tokens.ts (TypeScript con tipos borrables): Node 24 lo carga
// con require() y Tailwind, si hiciera falta, con jiti.
const { colors, fontFamilies, fontSizes, radii } = require("./src/theme/tokens.ts");

const fontSize = Object.fromEntries(
  Object.entries(fontSizes).map(([k, v]) => [k, [`${v.size}px`, { lineHeight: `${v.lineHeight}px` }]]),
);
const fontFamily = Object.fromEntries(Object.entries(fontFamilies).map(([k, v]) => [k, [v]]));
const borderRadius = Object.fromEntries(Object.entries(radii).map(([k, v]) => [k, `${v}px`]));

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    // Sin utilidades de fontWeight: font-bold, font-medium… son familias (cada peso es su
    // propia fuente). Un fontWeight encima de la familia haría que Android la reemplace.
    fontWeight: {},
    extend: { colors, fontFamily, fontSize, borderRadius, spacing: { pantalla: "20px" } },
  },
};
