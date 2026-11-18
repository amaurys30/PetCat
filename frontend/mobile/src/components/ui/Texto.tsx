import { Text, type TextProps } from "react-native";

// Escala de la guía visual. Respeta el tamaño de texto del sistema (sin allowFontScaling=false).
const variantes = {
  hero: "font-extranegrita text-hero",
  titulo: "font-extranegrita text-titulo",
  seccion: "font-negrita text-seccion",
  cuerpo: "font-sans text-cuerpo",
  apoyo: "font-medio text-apoyo",
} as const;

export type VarianteTexto = keyof typeof variantes;

type Props = TextProps & { variante?: VarianteTexto; className?: string };

export function Texto({ variante = "cuerpo", className = "", ...props }: Props) {
  const encabezado = variante === "hero" || variante === "titulo" || variante === "seccion";
  return (
    <Text
      accessibilityRole={encabezado ? "header" : undefined}
      className={`text-ink ${variantes[variante]} ${className}`}
      {...props}
    />
  );
}
