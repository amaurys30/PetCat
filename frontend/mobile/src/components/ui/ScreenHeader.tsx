import type { Href } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useVolver } from "@/lib/navegacion";
import { colors } from "@/theme/tokens";

import { Text } from "./Text";

type Props = {
  titulo: string;
  subtitulo?: string;
  /** Muestra la flecha Volver; la ruta es el respaldo si no hay historial (ver lib/navegacion). */
  volverA?: Href;
  /** Acción a la derecha (un botón de ícono con su etiqueta). */
  accion?: ReactNode;
};

export function ScreenHeader({ titulo, subtitulo, volverA, accion }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-row items-center gap-2 px-pantalla pb-3" style={{ paddingTop: insets.top + 12 }}>
      {volverA !== undefined && <FlechaVolver respaldo={volverA} />}
      <View className="flex-1 gap-0.5">
        <Text variante="titulo">{titulo}</Text>
        {subtitulo && (
          <Text variante="apoyo" className="text-muted">
            {subtitulo}
          </Text>
        )}
      </View>
      {accion}
    </View>
  );
}

function FlechaVolver({ respaldo }: { respaldo: Href }) {
  const volver = useVolver(respaldo);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Volver"
      onPress={volver}
      className="-ml-3 h-12 w-12 items-center justify-center rounded-full active:bg-track"
    >
      <ChevronLeft size={26} color={colors.ink} />
    </Pressable>
  );
}
