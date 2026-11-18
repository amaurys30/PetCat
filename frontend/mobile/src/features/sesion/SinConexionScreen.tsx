import { WifiOff } from "lucide-react-native";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, Text } from "@/components/ui";
import { colors } from "@/theme/tokens";

type Props = { onReintentar: () => void; reintentando: boolean };

// Al abrir la app con sesión guardada y sin conexión: la sesión se conserva y se reintenta sola
// cuando vuelve la red (useArranque).
export function SinConexionScreen({ onReintentar, reintentando }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-1 items-center justify-center gap-4 px-pantalla" accessibilityLiveRegion="polite">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-danger-soft">
          <WifiOff size={36} color={colors["danger-ink"]} accessibilityElementsHidden />
        </View>
        <Text variante="titulo" className="text-center">
          Sin conexión
        </Text>
        <Text className="text-center text-muted">
          No pudimos conectar con PetCat. Tu sesión sigue guardada: volveremos a intentarlo cuando regrese la
          conexión.
        </Text>
        <Button
          titulo="Reintentar"
          cargando={reintentando}
          onPress={onReintentar}
          className="mt-2 self-stretch"
        />
      </View>
    </SafeAreaView>
  );
}
