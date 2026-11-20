import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

type Props = {
  children: ReactNode;
  /** Con onPress la tarjeta entera es un botón y necesita una etiqueta para lectores. */
  onPress?: () => void;
  /** Sin onPress: la tarjeta es un solo elemento para el lector, con este texto. */
  accessibilityLabel?: string;
  className?: string;
  testID?: string;
};

export function Card({ children, onPress, accessibilityLabel, className = "", testID }: Props) {
  const estilo = `rounded-card border border-border bg-white p-4 ${className}`;
  if (!onPress) {
    return (
      <View
        className={estilo}
        accessible={!!accessibilityLabel}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        {children}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      className={`${estilo} active:opacity-90`}
    >
      {children}
    </Pressable>
  );
}
