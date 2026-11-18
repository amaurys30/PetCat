import { useRouter } from "expo-router";
import { Hourglass } from "lucide-react-native";
import { View } from "react-native";

import { EmptyState, ScreenHeader } from "@/components/ui";

// Marcador de Crear cuenta (M2) e Iniciar sesión (M3), que llegan en la fase M1.
export function ProximamenteScreen({ titulo }: { titulo: string }) {
  const router = useRouter();
  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader titulo={titulo} onVolver={() => router.back()} />
      <EmptyState
        icono={Hourglass}
        titulo="Muy pronto"
        descripcion="Esta pantalla llega en la fase M1 de la app."
        accion={{ etiqueta: "Volver", onPress: () => router.back() }}
      />
    </View>
  );
}
