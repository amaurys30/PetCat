import { Text as RNText, type TextProps } from "react-native";

// Escala de la guía: título 28/800, sección 18/800, cuerpo 15/400–500, apoyo 13/500,
// rótulo 11 (mínimo, solo rótulos). Cada peso es su propia familia (font-*).
// Respeta el tamaño de texto del sistema: no desactivar allowFontScaling.
const variantes = {
  hero: "font-extrabold text-hero",
  titulo: "font-extrabold text-titulo",
  seccion: "font-extrabold text-seccion",
  cuerpo: "font-regular text-cuerpo",
  cuerpoMedio: "font-medium text-cuerpo",
  apoyo: "font-medium text-apoyo",
  rotulo: "font-semibold text-rotulo",
} as const;

export type VarianteTexto = keyof typeof variantes;

const ENCABEZADOS: VarianteTexto[] = ["hero", "titulo", "seccion"];
const CLASE_PESO = /(^|\s)font-(regular|medium|semibold|bold|extrabold)(\s|$)/;

export type TextPropsPetCat = TextProps & { variante?: VarianteTexto; className?: string };

export function Text({ variante = "cuerpo", className = "", accessibilityRole, ...props }: TextPropsPetCat) {
  // Si className trae su propio peso, manda ese: con dos font-* no gana el último escrito.
  const base = CLASE_PESO.test(className)
    ? variantes[variante].replace(/font-\S+\s?/, "")
    : variantes[variante];
  return (
    <RNText
      accessibilityRole={accessibilityRole ?? (ENCABEZADOS.includes(variante) ? "header" : undefined)}
      className={`text-ink ${base} ${className}`}
      {...props}
    />
  );
}
