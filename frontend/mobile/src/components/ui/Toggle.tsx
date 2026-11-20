import { Pressable, View } from "react-native";

import { colors } from "@/theme/tokens";

import { Text } from "./Text";

type Props = {
  etiqueta: string;
  descripcion?: string;
  activo: boolean;
  onCambiar: (activo: boolean) => void;
  disabled?: boolean;
  className?: string;
};

// Toda la fila es el interruptor (área táctil grande). Apagado: pista `muted` (5,9:1 sobre
// blanco), que cumple el 3:1 de los controles; encendido: `primary-strong`.
export function Toggle({
  etiqueta,
  descripcion,
  activo,
  onCambiar,
  disabled = false,
  className = "",
}: Props) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={etiqueta}
      accessibilityHint={descripcion}
      accessibilityState={{ checked: activo, disabled }}
      disabled={disabled}
      onPress={() => onCambiar(!activo)}
      className={`min-h-12 flex-row items-center gap-3 py-2 ${className}`}
    >
      <View className="flex-1 gap-0.5">
        <Text variante="cuerpoMedio">{etiqueta}</Text>
        {descripcion && (
          <Text variante="apoyo" className="text-muted">
            {descripcion}
          </Text>
        )}
      </View>
      <View
        className="h-7 w-12 justify-center rounded-full px-0.5"
        style={{
          backgroundColor: disabled ? colors.track : activo ? colors["primary-strong"] : colors.muted,
          alignItems: activo ? "flex-end" : "flex-start",
        }}
      >
        <View className="h-6 w-6 rounded-full bg-white" />
      </View>
    </Pressable>
  );
}
