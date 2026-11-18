import { useRouter } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Boton } from "@/components/ui/Boton";
import { Texto } from "@/components/ui/Texto";

// Marcador de las pantallas que llegan en la siguiente fase (Crear cuenta e Iniciar sesión).
export function ProximamenteScreen({ titulo }: { titulo: string }) {
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-fondo">
      <View className="flex-1 justify-center gap-4 px-6">
        <Texto variante="titulo">{titulo}</Texto>
        <Texto className="text-muted">Esta pantalla llega en la próxima fase de la app.</Texto>
        <Boton variante="secundario" titulo="Volver" onPress={() => router.back()} className="mt-4" />
      </View>
    </SafeAreaView>
  );
}
