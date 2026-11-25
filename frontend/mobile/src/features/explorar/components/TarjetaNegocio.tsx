import { useRouter } from "expo-router";
import { ChevronRight, Navigation, Star } from "lucide-react-native";
import { Alert, Linking, Pressable, View } from "react-native";

import type { NegocioBusqueda } from "@/api/types";
import { Avatar, Button, Card, Text } from "@/components/ui";
import { colors } from "@/theme/tokens";

import {
  enlacesComoLlegar,
  etiquetaNegocio,
  formatearCalificacion,
  formatearDistancia,
  nombreTipo,
  textoApertura,
} from "../logica";
import type { Coordenada } from "../mapa/protocolo";

/** Elige la app y abre la ruta hasta la coordenada (enlaces web: abren la app si está instalada). */
export function comoLlegar(nombre: string, destino: Coordenada) {
  const { google, waze } = enlacesComoLlegar(destino);
  Alert.alert(`Cómo llegar a ${nombre}`, "¿Con qué app?", [
    { text: "Google Maps", onPress: () => void Linking.openURL(google) },
    { text: "Waze", onPress: () => void Linking.openURL(waze) },
    { text: "Cancelar", style: "cancel" },
  ]);
}

type Props = {
  negocio: NegocioBusqueda;
  /** Distancia solo si es la del teléfono (no con el centro de Sincelejo). */
  conDistancia: boolean;
};

/**
 * Negocio en el mapa (tarjeta inferior) y en la lista. La información (logo, nombre, tipo,
 * calificación y estado) es un botón que abre el perfil: "Ver perfil de X", con los datos en la
 * pista (etiquetaNegocio). Agendar y Cómo llegar van aparte, fuera de ese botón: nada tocable
 * dentro de otro elemento tocable.
 */
export function TarjetaNegocio({ negocio: n, conDistancia }: Props) {
  const router = useRouter();
  const sede = n.sucursal_cercana;
  const abierto = sede?.abierto_ahora ?? false;
  return (
    <View testID={`negocio-${n.id_negocio}`}>
      <Card className="gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver perfil de ${n.nombre}`}
          accessibilityHint={etiquetaNegocio(n, conDistancia)}
          onPress={() => router.push({ pathname: "/negocios/[id]", params: { id: n.id_negocio } })}
          className="flex-row items-center gap-3 active:opacity-70"
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Avatar nombre={n.nombre} uri={n.logo_miniatura_url} tamano="md" />
          </View>
          <View className="flex-1 gap-1">
            <Text variante="seccion" numberOfLines={2}>
              {n.nombre}
            </Text>
            <View className="flex-row flex-wrap items-center gap-x-2">
              <Text variante="apoyo" className="text-muted">
                {nombreTipo(n.tipo)}
              </Text>
              {n.total_resenas > 0 ? (
                <View className="flex-row items-center gap-1">
                  <Star size={14} color={colors["sun-ink"]} fill={colors.sun} />
                  <Text variante="apoyo" className="font-bold">
                    {formatearCalificacion(n.calificacion_promedio)}
                  </Text>
                  <Text variante="apoyo" className="text-muted">{`(${n.total_resenas})`}</Text>
                </View>
              ) : (
                <Text variante="apoyo" className="text-muted">
                  Sin reseñas
                </Text>
              )}
              {conDistancia && n.distancia_km !== null && (
                <Text
                  variante="apoyo"
                  className="text-muted"
                >{`· ${formatearDistancia(n.distancia_km)}`}</Text>
              )}
            </View>
            {sede && (
              <View
                className="flex-row items-center gap-1.5 self-start rounded-full px-3 py-1"
                style={{ backgroundColor: abierto ? colors["primary-soft"] : colors.track }}
              >
                <View
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: abierto ? colors["primary-deep"] : colors.muted }}
                />
                <Text
                  variante="apoyo"
                  className="font-bold"
                  style={{ color: abierto ? colors["primary-deep"] : colors.muted }}
                >
                  {textoApertura(sede)}
                </Text>
              </View>
            )}
          </View>
          <ChevronRight size={22} color={colors.muted} accessibilityElementsHidden />
        </Pressable>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              titulo="Agendar"
              accessibilityLabel={`Agendar en ${n.nombre}`}
              onPress={() =>
                router.push({ pathname: "/negocios/[id]/agendar", params: { id: n.id_negocio } })
              }
            />
          </View>
          {sede && (
            <View className="flex-1">
              <Button
                titulo="Cómo llegar"
                variante="suave"
                icono={Navigation}
                accessibilityLabel={`Cómo llegar a ${n.nombre}`}
                onPress={() => comoLlegar(n.nombre, { lat: sede.latitud, lng: sede.longitud })}
              />
            </View>
          )}
        </View>
      </Card>
    </View>
  );
}
