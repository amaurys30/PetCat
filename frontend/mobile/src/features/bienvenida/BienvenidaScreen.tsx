import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRef, useState, type ComponentType } from "react";
import { FlatList, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, Text } from "@/components/ui";
import { gradients } from "@/theme/tokens";

import { IlustracionAgenda, IlustracionMascota, IlustracionPasaporte } from "./ilustraciones";

type Lamina = { id: string; titulo: string; cuerpo: string; Ilustracion: ComponentType };

export const LAMINAS: Lamina[] = [
  {
    id: "mascota",
    titulo: "Todo lo de tu mascota, en tu bolsillo.",
    cuerpo: "Su carnet de vacunas, sus citas y las veterinarias de Sincelejo, en un solo lugar.",
    Ilustracion: IlustracionMascota,
  },
  {
    id: "pasaporte",
    titulo: "Sus vacunas, siempre a mano.",
    cuerpo: "Un pasaporte digital con cada vacuna sellada por su veterinaria. Compártelo con un QR.",
    Ilustracion: IlustracionPasaporte,
  },
  {
    id: "agenda",
    titulo: "Agenda en la veterinaria de tu barrio.",
    cuerpo: "Mira las horas libres, reserva en segundos y recibe un recordatorio el día antes.",
    Ilustracion: IlustracionAgenda,
  },
];

/**
 * M1 · Bienvenida: la entrada sin sesión. Carrusel de 3 láminas sin avance automático. Para el
 * lector de pantalla es un solo control ajustable ("Lámina 1 de 3", con el título y el texto):
 * se cambia con los gestos de subir y bajar; las ilustraciones son decorativas.
 * El texto blanco va en la mitad inferior, donde el degradado ya es primary-strong o más oscuro.
 */
export function BienvenidaScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const lista = useRef<FlatList<Lamina>>(null);
  const [actual, setActual] = useState(0);

  const irA = (indice: number) => {
    const destino = Math.max(0, Math.min(LAMINAS.length - 1, indice));
    lista.current?.scrollToIndex({ index: destino, animated: true });
    setActual(destino);
  };

  // onViewableItemsChanged no puede cambiar entre renders: se crea una vez.
  const [alCambiarVisible] = useState(
    () =>
      ({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
        const visible = viewableItems[0]?.index;
        if (typeof visible === "number") setActual(visible);
      },
  );

  const lamina = LAMINAS[actual]!;

  return (
    <LinearGradient colors={gradients.brand.colors} locations={gradients.brand.locations} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View
          className="flex-1"
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${lamina.titulo} ${lamina.cuerpo}`}
          accessibilityValue={{ text: `Lámina ${actual + 1} de ${LAMINAS.length}` }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) =>
            irA(e.nativeEvent.actionName === "increment" ? actual + 1 : actual - 1)
          }
          testID="carrusel-bienvenida"
        >
          <FlatList
            ref={lista}
            data={LAMINAS}
            keyExtractor={(l) => l.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={alCambiarVisible}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            renderItem={({ item }) => (
              <View style={{ width }} className="flex-1 justify-between px-pantalla pt-4">
                <item.Ilustracion />
                <View className="gap-3">
                  <Text variante="hero" className="text-white">
                    {item.titulo}
                  </Text>
                  <Text className="text-white">{item.cuerpo}</Text>
                </View>
              </View>
            )}
          />
        </View>

        <View className="gap-3 px-pantalla pb-6 pt-5">
          <View
            className="mb-2 flex-row gap-2"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {LAMINAS.map((l, i) => (
              <View
                key={l.id}
                className="h-2 rounded-full bg-white"
                style={{ width: i === actual ? 24 : 8, opacity: i === actual ? 1 : 0.5 }}
              />
            ))}
          </View>
          <Button variante="claro" titulo="Crear mi cuenta" onPress={() => router.push("/registro")} />
          <Button variante="contornoClaro" titulo="Ya tengo cuenta" onPress={() => router.push("/login")} />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
