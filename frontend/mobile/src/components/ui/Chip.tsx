import type { LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { colors } from "@/theme/tokens";

import { Text } from "./Text";

type Props = {
  etiqueta: string;
  icono?: LucideIcon;
  /** Con onPress es un filtro seleccionable; sin él, una etiqueta informativa. */
  onPress?: () => void;
  seleccionado?: boolean;
  className?: string;
};

// Visualmente mide 36 px; hitSlop de 6 arriba y abajo lleva el área táctil a 48.
export function Chip({ etiqueta, icono: Icono, onPress, seleccionado = false, className = "" }: Props) {
  const caja = seleccionado ? "bg-primary-strong" : "border border-border bg-white";
  const texto = seleccionado ? "text-white" : "text-ink";
  const color = seleccionado ? colors.white : colors["primary-strong"];

  const contenido = (
    <>
      {Icono && <Icono size={16} color={color} accessibilityElementsHidden />}
      <Text variante="apoyo" className={`font-semibold ${texto}`} numberOfLines={1}>
        {etiqueta}
      </Text>
    </>
  );
  const estilo = `h-9 flex-row items-center gap-1.5 rounded-chip px-3 ${caja} ${className}`;

  if (!onPress) return <View className={estilo}>{contenido}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ selected: seleccionado }}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      onPress={onPress}
      className={`${estilo} active:opacity-80`}
    >
      {contenido}
    </Pressable>
  );
}
