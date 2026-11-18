// Tokens de diseño de la app (guía visual "PetCat App · Lenguaje visual").
// Única fuente: los leen tailwind.config.js (clases de NativeWind) y el código TypeScript
// (props que no aceptan clases, como los colores de un degradado o de un ícono).
// Contraste: texto blanco solo sobre `primary` (#0F7D76) o más oscuro. `marca`, `coral`,
// `sol` y `lavanda` son decorativos: nunca llevan texto encima ni son color de texto.

const colors = {
  marca: "#14A39A", // Teal marca, decorativo
  primary: "#0F7D76", // Teal fuerte: botones, enlaces; blanco encima cumple AA
  "primary-deep": "#0B6F69", // Teal profundo: final del degradado, texto sobre primary-soft
  "primary-soft": "#E3F6F3", // Teal suave: fondos de acento, chips
  ink: "#1E2A3B", // Tinta: texto principal
  muted: "#55667A", // Texto 2: texto secundario (AA sobre blanco y sobre fondo)
  coral: "#FF8A65", // Acento
  sol: "#FFC857", // Acento
  lavanda: "#7C5CD6", // Acento
  fondo: "#F6F8F9", // Fondo de pantalla
  white: "#FFFFFF",
  // Del panel web, para bordes y estados
  border: "#E3E8EC",
  danger: "#D31E24",
  "danger-soft": "#FDECEC",
  "warning-ink": "#A25D00",
  "warning-soft": "#FFF2D9",
  info: "#1368DB",
  "info-soft": "#EAF2FE",
};

// En Android un peso solo funciona con su propia familia: cada peso es una clase
// (font-negrita) y no se combina con font-bold.
const fontFamily = {
  sans: ["PlusJakartaSans_400Regular"],
  medio: ["PlusJakartaSans_500Medium"],
  seminegrita: ["PlusJakartaSans_600SemiBold"],
  negrita: ["PlusJakartaSans_700Bold"],
  extranegrita: ["PlusJakartaSans_800ExtraBold"],
};

// Escala tipográfica de la guía: título 28, sección 18, texto 15, apoyo 13 (mínimo).
const fontSize = {
  apoyo: ["13px", { lineHeight: "18px" }],
  cuerpo: ["15px", { lineHeight: "22px" }],
  seccion: ["18px", { lineHeight: "24px" }],
  titulo: ["28px", { lineHeight: "34px" }],
  hero: ["40px", { lineHeight: "46px" }],
};

const borderRadius = { control: "16px", tarjeta: "20px", hoja: "28px" };

// Degradado de las pantallas de marca: de 50 % hacia abajo ya es primary o más oscuro,
// así el texto blanco que va en la mitad inferior cumple AA.
const degradadoMarca = {
  colors: [colors.marca, colors.primary, colors["primary-deep"]],
  locations: [0, 0.5, 1],
};

// Áreas táctiles mínimas (48 x 48) y separación entre acciones (8).
const tactil = { minimo: 48, separacion: 8 };

module.exports = { colors, fontFamily, fontSize, borderRadius, degradadoMarca, tactil };
