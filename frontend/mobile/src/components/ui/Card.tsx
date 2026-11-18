import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

type Props = {
  children: ReactNode;
  /** Con onPress la tarjeta entera es un botón y necesita una etiqueta para lectores. */
  onPress?: () => void;
  accessibilityLabel?: string;
  className?: string;
};

export function Card({ children, onPress, accessibilityLabel, className = "" }: Props) {
  const estilo = `rounded-card border border-border bg-white p-4 ${className}`;
  if (!onPress) return <View className={estilo}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className={`${estilo} active:opacity-90`}
    >
      {children}
    </Pressable>
  );
}
