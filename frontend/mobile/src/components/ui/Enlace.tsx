import { Pressable, type PressableProps } from "react-native";

import { Text } from "./Text";

type Props = Omit<PressableProps, "children"> & {
  titulo: string;
  /** "button" para acciones que no navegan (reenviar, hacerlo después). */
  rol?: "link" | "button";
  className?: string;
  /** Color del texto: primary-strong sobre claro (AA), white sobre el degradado oscuro. */
  claro?: boolean;
};

/** Enlace de texto con área táctil de 48 px de alto. */
export function Enlace({ titulo, rol = "link", className = "", claro = false, ...props }: Props) {
  return (
    <Pressable
      accessibilityRole={rol}
      accessibilityLabel={titulo}
      className={`min-h-12 justify-center active:opacity-70 ${className}`}
      {...props}
    >
      <Text variante="cuerpo" className={`font-bold ${claro ? "text-white" : "text-primary-strong"}`}>
        {titulo}
      </Text>
    </Pressable>
  );
}
