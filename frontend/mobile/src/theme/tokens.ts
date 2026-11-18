// Tokens de diseño de la app (CLAUDE.md, sección 2). Única fuente de colores, radios,
// tipografía y espaciado: tailwind.config.js los expone a NativeWind y el código los usa
// donde no hay clases (degradados, colores de íconos). No escribir hex sueltos en componentes.
//
// Este archivo lo carga también tailwind.config.js con require(): solo sintaxis de tipos que
// se pueda borrar (nada de enum ni namespace).

export const colors = {
  primary: "#14A39A", // decorativo: nunca texto blanco encima
  "primary-strong": "#0F7D76", // botones; blanco encima 5:1
  "primary-deep": "#0B6F69", // texto sobre primary-soft, final de degradados
  "primary-soft": "#E3F6F3",
  ink: "#1E2A3B",
  muted: "#55667A",
  subtle: "#8A97A6", // solo placeholders y rótulos decorativos
  border: "#E3E8EC",
  surface: "#F6F8F9",
  track: "#EEF2F4",
  white: "#FFFFFF",
  coral: "#FF8A65",
  "coral-from": "#FF9E7A",
  "coral-to": "#F0643C",
  "coral-ink": "#3A1408", // texto sobre el degradado coral
  "coral-dark": "#B5462A", // texto coral sobre blanco o coral-soft
  "coral-soft": "#FFEDE6",
  sun: "#FFC857",
  "sun-soft": "#FFF5DC",
  "sun-ink": "#9A5800",
  lavender: "#7C5CD6",
  "lavender-soft": "#EEE8FB",
  "lavender-ink": "#5A3FB0",
  info: "#2F80ED",
  "info-soft": "#EAF2FE",
  "info-ink": "#1F5FBF",
  danger: "#D93F44", // íconos y bordes; como texto no llega a AA
  "danger-soft": "#FDECEC",
  "danger-ink": "#B3262B", // texto de error y fondo del botón de peligro
  "passport-from": "#0E2A33",
  "passport-to": "#132F3D",
  "brand-from": "#17B5AB",
} as const;

export type ColorToken = keyof typeof colors;

// Degradados (expo-linear-gradient). El de marca pasa por primary-strong a la mitad: el texto
// blanco va de la mitad hacia abajo, donde el fondo ya es primary-strong o más oscuro.
export const gradients = {
  brand: {
    colors: [colors["brand-from"], colors["primary-strong"], colors["primary-deep"]],
    locations: [0, 0.5, 1],
  },
  coral: { colors: [colors["coral-from"], colors["coral-to"]], locations: [0, 1] },
  passport: { colors: [colors["passport-from"], colors["passport-to"]], locations: [0, 1] },
} as const;

// Android no sintetiza negritas con fuentes propias: cada peso es su propia familia.
export const fontFamilies = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
} as const;

export type FontWeightToken = keyof typeof fontFamilies;

// Escala: título 28/800, sección 18/800, cuerpo 15/400–500, apoyo 13/500, rótulo 11 (mínimo).
export const fontSizes = {
  rotulo: { size: 11, lineHeight: 14 },
  apoyo: { size: 13, lineHeight: 18 },
  cuerpo: { size: 15, lineHeight: 22 },
  seccion: { size: 18, lineHeight: 24 },
  titulo: { size: 28, lineHeight: 34 },
  hero: { size: 36, lineHeight: 42 },
} as const;

export const radii = {
  chip: 12,
  control: 16,
  card: 20,
  "card-lg": 24,
  passport: 26,
  frame: 36,
} as const;

export const spacing = {
  base: 4,
  pantalla: 20, // padding horizontal de pantalla
} as const;

// Áreas táctiles mínimas (48 × 48) y separación entre acciones (8).
export const touch = { min: 48, gap: 8 } as const;
