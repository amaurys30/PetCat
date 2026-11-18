import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";

import { colors } from "@/theme/tokens";

import { Button } from "./Button";
import { Text } from "./Text";

type Props = {
  icono: LucideIcon;
  titulo: string;
  descripcion?: string;
  accion?: { etiqueta: string; onPress: () => void };
  className?: string;
};

export function EmptyState({ icono: Icono, titulo, descripcion, accion, className = "" }: Props) {
  return (
    <View className={`items-center gap-3 px-pantalla py-10 ${className}`}>
      <View className="h-20 w-20 items-center justify-center rounded-full bg-primary-soft">
        <Icono size={36} color={colors["primary-deep"]} accessibilityElementsHidden />
      </View>
      <Text variante="seccion" className="text-center">
        {titulo}
      </Text>
      {descripcion && <Text className="text-center text-muted">{descripcion}</Text>}
      {accion && <Button titulo={accion.etiqueta} onPress={accion.onPress} className="mt-2 self-stretch" />}
    </View>
  );
}
