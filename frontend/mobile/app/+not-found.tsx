import { useRouter } from "expo-router";
import { MapPinOff } from "lucide-react-native";
import { View } from "react-native";

import { EmptyState, ScreenHeader } from "@/components/ui";

export default function NoEncontrada() {
  const router = useRouter();
  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader titulo="No encontrada" />
      <EmptyState
        icono={MapPinOff}
        titulo="No encontramos esta pantalla"
        descripcion="Puede que el enlace esté viejo o mal escrito."
        accion={{ etiqueta: "Ir al inicio", onPress: () => router.replace("/") }}
      />
    </View>
  );
}
