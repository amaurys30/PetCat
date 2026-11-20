import { useQueryClient } from "@tanstack/react-query";
import { WifiOff } from "lucide-react-native";
import { useState } from "react";
import { AccessibilityInfo, View } from "react-native";

import { Button, Text } from "@/components/ui";
import { queryKeys } from "@/lib/queryKeys";
import { useSesion } from "@/store/sesion";
import { colors } from "@/theme/tokens";

import { reconectar } from "../../sesion/acciones";

/** "hace unos segundos", "hace 5 min", "hace 2 h". */
export function haceCuanto(desde: number, ahora = Date.now()): string {
  const minutos = Math.floor((ahora - desde) / 60_000);
  if (minutos < 1) return "hace unos segundos";
  if (minutos < 60) return `hace ${minutos} min`;
  return `hace ${Math.floor(minutos / 60)} h`;
}

/**
 * Aviso de las pantallas de datos cuando la app se abrió sin red con datos guardados.
 * Reintentar entra si ya hay red (useArranque también reintenta solo al volver la red).
 */
export function AvisoSinConexion() {
  const modoSinConexion = useSesion((s) => s.modoSinConexion);
  const queryClient = useQueryClient();
  const [reintentando, setReintentando] = useState(false);
  if (!modoSinConexion) return null;

  const actualizado = queryClient.getQueryState(queryKeys.mascotas.lista())?.dataUpdatedAt;
  const texto = actualizado ? `Sin conexión · datos de ${haceCuanto(actualizado)}` : "Sin conexión";

  const reintentar = async () => {
    setReintentando(true);
    try {
      const resultado = await reconectar();
      if (resultado !== "autenticada") AccessibilityInfo.announceForAccessibility("Sigues sin conexión");
    } finally {
      setReintentando(false);
    }
  };

  return (
    <View className="mx-pantalla mb-3 gap-2 rounded-card bg-danger-soft p-3" accessibilityLiveRegion="polite">
      <View className="flex-row items-center gap-2">
        <WifiOff size={18} color={colors["danger-ink"]} accessibilityElementsHidden />
        <Text variante="apoyo" className="flex-1 font-semibold text-danger-ink">
          {texto}
        </Text>
      </View>
      <Text variante="apoyo" className="text-ink">
        Ves lo último que guardamos. Para agregar o editar, espera a tener conexión.
      </Text>
      <Button titulo="Reintentar" variante="secundario" cargando={reintentando} onPress={reintentar} />
    </View>
  );
}
