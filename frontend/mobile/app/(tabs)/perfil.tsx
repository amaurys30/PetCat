import { useRouter } from "expo-router";
import { CircleUserRound, Wifi } from "lucide-react-native";
import { ScrollView, View } from "react-native";

import { Button, EmptyState, ScreenHeader } from "@/components/ui";

export default function Perfil() {
  const router = useRouter();
  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader titulo="Perfil" />
      <ScrollView contentContainerClassName="pb-8">
        <EmptyState
          icono={CircleUserRound}
          titulo="Todavía no has iniciado sesión"
          descripcion="El registro y el inicio de sesión llegan en la fase M1."
          accion={{ etiqueta: "Ver la bienvenida", onPress: () => router.push("/bienvenida") }}
        />
        {__DEV__ && (
          <View className="px-pantalla">
            <Button
              titulo="Diagnóstico de la conexión"
              variante="suave"
              icono={Wifi}
              onPress={() => router.push("/dev/estado")}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
