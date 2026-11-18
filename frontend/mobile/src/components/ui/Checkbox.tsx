import { Check } from "lucide-react-native";
import type { ComponentRef, Ref } from "react";
import { Pressable, View } from "react-native";

import { colors } from "@/theme/tokens";

import { Text } from "./Text";

type Props = {
  etiqueta: string;
  marcado: boolean;
  onCambiar: (marcado: boolean) => void;
  error?: string;
  ref?: Ref<ComponentRef<typeof Pressable>>;
  className?: string;
};

// Toda la fila es la casilla (área táctil grande). Un enlace relacionado ("Ver política") va
// fuera de ella: dos elementos tocables anidados confunden al lector de pantalla.
export function Checkbox({ etiqueta, marcado, onCambiar, error, ref, className = "" }: Props) {
  return (
    <View className={`gap-1.5 ${className}`}>
      <Pressable
        ref={ref}
        accessibilityRole="checkbox"
        accessibilityLabel={error ? `${etiqueta}. Error: ${error}` : etiqueta}
        accessibilityState={{ checked: marcado }}
        onPress={() => onCambiar(!marcado)}
        className="min-h-12 flex-row items-center gap-3 py-2"
      >
        <View
          className={`h-7 w-7 items-center justify-center rounded-lg border-2 ${
            marcado
              ? "border-primary-strong bg-primary-strong"
              : error
                ? "border-danger bg-white"
                : "border-muted bg-white"
          }`}
        >
          {marcado && <Check size={18} color={colors.white} strokeWidth={3} />}
        </View>
        <Text className="flex-1">{etiqueta}</Text>
      </Pressable>
      {error && (
        <Text variante="apoyo" className="text-danger-ink" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
}
