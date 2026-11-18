import { CircleAlert } from "lucide-react-native";
import type { ComponentRef, Ref } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { colors } from "@/theme/tokens";

import { Text } from "./Text";

type Props = TextInputProps & {
  etiqueta: string;
  error?: string;
  ayuda?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
  className?: string;
};

export function Input({ etiqueta, error, ayuda, className = "", ref, ...props }: Props) {
  // El lector anuncia el error junto con el campo, no solo con el borde rojo.
  const etiquetaAccesible = error ? `${etiqueta}. Error: ${error}` : etiqueta;

  return (
    <View className={`gap-1.5 ${className}`}>
      <Text variante="apoyo" className="text-ink" importantForAccessibility="no">
        {etiqueta}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={etiquetaAccesible}
        placeholderTextColor={colors.subtle}
        className={`min-h-12 rounded-control border bg-white px-4 py-3 font-regular text-cuerpo text-ink ${
          error ? "border-danger" : "border-border focus:border-primary-strong"
        }`}
        {...props}
      />
      {error ? (
        <View className="flex-row items-center gap-1.5" accessibilityLiveRegion="polite">
          <CircleAlert size={16} color={colors["danger-ink"]} accessibilityElementsHidden />
          <Text variante="apoyo" className="flex-1 text-danger-ink">
            {error}
          </Text>
        </View>
      ) : ayuda ? (
        <Text variante="apoyo" className="text-muted">
          {ayuda}
        </Text>
      ) : null}
    </View>
  );
}
