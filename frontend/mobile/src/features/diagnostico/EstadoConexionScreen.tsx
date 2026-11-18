import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { CircleCheck } from "lucide-react-native";
import { ScrollView, View } from "react-native";

import { Button, Card, ErrorState, ScreenHeader, SkeletonLista, Text } from "@/components/ui";
import { env } from "@/lib/env";
import { colors } from "@/theme/tokens";

import { useSalud } from "./useSalud";

// Solo en desarrollo: confirma que el teléfono llega a la API de demo (GET /health).
export function EstadoConexionScreen() {
  const router = useRouter();
  const salud = useSalud();

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader titulo="Conexión" subtitulo="Solo en desarrollo" onVolver={() => router.back()} />
      <ScrollView contentContainerClassName="gap-4 pb-8">
        <View className="gap-3 px-pantalla">
          <Fila etiqueta="API" valor={env.apiUrl} />
          <Fila etiqueta="Servidor de Expo" valor={Constants.expoConfig?.hostUri ?? "sin dato"} />
        </View>

        {salud.isPending && <SkeletonLista filas={1} etiqueta="Comprobando la conexión" />}
        {salud.isError && (
          <ErrorState
            error={salud.error}
            titulo="El teléfono no llega a la API"
            onReintentar={() => salud.refetch()}
            reintentando={salud.isFetching}
          />
        )}
        {salud.isSuccess && (
          <View className="gap-4 px-pantalla">
            <Card className="flex-row items-center gap-3 bg-primary-soft">
              <CircleCheck size={28} color={colors["primary-deep"]} accessibilityElementsHidden />
              <View className="flex-1">
                <Text variante="seccion" className="text-primary-deep">
                  Conectada
                </Text>
                <Text variante="apoyo" className="text-primary-deep">
                  Base de datos: {salud.data.db}. Encendida hace {salud.data.uptime} s.
                </Text>
              </View>
            </Card>
            <Button
              titulo="Comprobar de nuevo"
              variante="secundario"
              cargando={salud.isFetching}
              onPress={() => salud.refetch()}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View className="gap-0.5">
      <Text variante="apoyo" className="text-muted">
        {etiqueta}
      </Text>
      <Text selectable>{valor}</Text>
    </View>
  );
}
