import Constants from "expo-constants";
import { CircleAlert, CircleCheck } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API_URL } from "@/api/config";
import { ApiError } from "@/api/errores";
import { Boton } from "@/components/ui/Boton";
import { Texto } from "@/components/ui/Texto";
import { colors } from "@/theme/tokens";

import { useSalud } from "../hooks/useSalud";

// Solo en desarrollo: confirma que el teléfono llega a la API de demo (GET /health).
export function EstadoConexionScreen() {
  const salud = useSalud();
  const error = salud.error instanceof ApiError ? salud.error : null;

  const fondo = salud.isSuccess ? "bg-primary-soft" : salud.isError ? "bg-danger-soft" : "bg-white";
  const titulo = salud.isPending ? "Comprobando…" : salud.isSuccess ? "Conectada" : "Sin conexión con la API";

  return (
    <SafeAreaView className="flex-1 bg-fondo" edges={["bottom"]}>
      <ScrollView contentContainerClassName="gap-4 p-6">
        <Fila etiqueta="API" valor={API_URL} />
        <Fila etiqueta="Servidor de Expo" valor={Constants.expoConfig?.hostUri ?? "sin dato"} />

        <View
          className={`flex-row items-start gap-3 rounded-tarjeta p-4 ${fondo}`}
          accessibilityLiveRegion="polite"
        >
          {salud.isSuccess && <CircleCheck size={24} color={colors["primary-deep"]} />}
          {salud.isError && <CircleAlert size={24} color={colors.danger} />}
          <View className="flex-1 gap-1">
            <Texto variante="seccion">{titulo}</Texto>
            {salud.isSuccess && (
              <Texto className="text-muted">
                Base de datos: {salud.data.db}. Encendida hace {salud.data.uptime} s.
              </Texto>
            )}
            {error && (
              <Texto className="text-muted">
                {error.sinConexion
                  ? "El teléfono no llega a la API. Revisa que la API de demo esté abierta a la red local (DEMO_BIND) o usa adb reverse; detalle en frontend/mobile/README.md."
                  : `${error.status}: ${error.message}`}
              </Texto>
            )}
          </View>
        </View>

        <Boton titulo="Probar de nuevo" cargando={salud.isFetching} onPress={() => salud.refetch()} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View className="gap-1">
      <Texto variante="apoyo" className="text-muted">
        {etiqueta}
      </Texto>
      <Texto selectable>{valor}</Texto>
    </View>
  );
}
