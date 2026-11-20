import { useRouter } from "expo-router";
import { Navigation, Star } from "lucide-react-native";
import { Alert, Linking, View } from "react-native";

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
 * Negocio en el mapa (tarjeta inferior) y en la lista. Para el lector, los datos son un solo
 * elemento (etiquetaNegocio) y las acciones van aparte, con el nombre del negocio.
 */
export function TarjetaNegocio({ negocio: n, conDistancia }: Props) {
  const router = useRouter();
  const sede = n.sucursal_cercana;
  const abierto = sede?.abierto_ahora ?? false;
  return (
    <View testID={`negocio-${n.id_negocio}`}>
      <Card className="gap-3">
        <View accessible accessibilityLabel={etiquetaNegocio(n, conDistancia)} className="flex-row gap-3">
          <Avatar nombre={n.nombre} uri={n.logo_miniatura_url} tamano="md" />
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
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              titulo="Agendar"
              accessibilityLabel={`Agendar en ${n.nombre}`}
              onPress={() => router.push(`/negocios/${n.id_negocio}`)}
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
