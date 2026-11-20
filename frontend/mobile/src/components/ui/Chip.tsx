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
  // Lo que cambia al seleccionar va en style (ver sombras en tokens.ts); el borde siempre existe.
  const caja = {
    backgroundColor: seleccionado ? colors["primary-strong"] : colors.white,
    borderColor: seleccionado ? colors["primary-strong"] : colors.border,
  };
  const texto = { color: seleccionado ? colors.white : colors.ink };
  const color = seleccionado ? colors.white : colors["primary-strong"];

  const contenido = (
    <>
      {Icono && <Icono size={16} color={color} accessibilityElementsHidden />}
      <Text variante="apoyo" className="font-semibold" style={texto} numberOfLines={1}>
        {etiqueta}
      </Text>
    </>
  );
  const estilo = `h-9 flex-row items-center gap-1.5 rounded-chip border px-3 ${className}`;

  if (!onPress)
    return (
      <View className={estilo} style={caja}>
        {contenido}
      </View>
    );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ selected: seleccionado }}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      onPress={onPress}
      className={`${estilo} active:opacity-80`}
      style={caja}
    >
      {contenido}
    </Pressable>
  );
}
