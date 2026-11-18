import { Hourglass } from "lucide-react-native";
import { View } from "react-native";

import { EmptyState, ScreenHeader } from "@/components/ui";
import { RESPALDO, useVolver } from "@/lib/navegacion";

// Marcador de Crear cuenta (M2) e Iniciar sesión (M3), que llegan en la fase M1.
export function ProximamenteScreen({ titulo }: { titulo: string }) {
  const volver = useVolver(RESPALDO.inicio);
  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader titulo={titulo} volverA={RESPALDO.inicio} />
      <EmptyState
        icono={Hourglass}
        titulo="Muy pronto"
        descripcion="Esta pantalla llega en la fase M1 de la app."
        accion={{ etiqueta: "Volver", onPress: volver }}
      />
    </View>
  );
}
