import type { BottomTabBarProps } from "expo-router/js-tabs";
import { CalendarDays, CircleUserRound, Compass, House, type LucideIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { colors, fontFamilies } from "@/theme/tokens";

import { CarnetTabButton } from "./CarnetTabButton";

// Cuánto sobresale el botón Carnet por encima de la barra blanca.
export const SOBRESALE = 20;
const ALTO_BARRA = 64;

const PESTANAS: Record<string, { etiqueta: string; icono: LucideIcon }> = {
  index: { etiqueta: "Inicio", icono: House },
  explorar: { etiqueta: "Explorar", icono: Compass },
  citas: { etiqueta: "Citas", icono: CalendarDays },
  perfil: { etiqueta: "Perfil", icono: CircleUserRound },
};

export const RUTA_CARNET = "carnet";

/**
 * Barra de pestañas propia sobre el navegador de Expo Router (la navegación, el estado y el
 * botón atrás siguen siendo los de React Navigation; solo cambia lo visual).
 *
 * Android no entrega toques a la parte de un hijo que sale de su padre. Por eso la barra es
 * más alta que el fondo blanco: arriba hay una franja transparente de SOBRESALE px que deja
 * pasar los toques (`pointerEvents="box-none"`), el fondo blanco es una capa interna, y el
 * círculo del Carnet queda completo dentro de los límites de la barra.
 */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const tecladoAbierto = useTecladoAbiertoAndroid();
  if (tecladoAbierto) return null;

  const abajo = Math.max(insets.bottom, 8);

  return (
    <View pointerEvents="box-none" style={{ paddingTop: SOBRESALE }} testID="tab-bar">
      {/* Fondo blanco: capa interna, debajo de la franja transparente. */}
      <View
        pointerEvents="none"
        className="absolute inset-x-0 bottom-0 border-t border-border bg-white"
        style={{ top: SOBRESALE }}
      />
      <View
        accessibilityRole="tablist"
        accessibilityLabel="Navegación principal"
        pointerEvents="box-none"
        className="flex-row px-2"
        style={{ marginTop: -SOBRESALE, paddingBottom: abajo }}
      >
        {state.routes.map((route, indice) => {
          const seleccionada = state.index === indice;
          const onPress = () => {
            const evento = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!seleccionada && !evento.defaultPrevented) navigateToTab(route.key);
          };
          const onLongPress = () => emitter.emit({ type: "tabLongPress", target: route.key });

          if (route.name === RUTA_CARNET) {
            return (
              <View key={route.key} pointerEvents="box-none" className="flex-1">
                <CarnetTabButton seleccionada={seleccionada} onPress={onPress} onLongPress={onLongPress} />
              </View>
            );
          }

          const pestana = PESTANAS[route.name];
          if (!pestana) return null;
          const Icono = pestana.icono;
          const color = seleccionada ? colors["primary-deep"] : colors.muted;

          return (
            <View key={route.key} pointerEvents="box-none" className="flex-1 justify-end">
              <Pressable
                accessibilityRole="tab"
                accessibilityLabel={pestana.etiqueta}
                accessibilityState={{ selected: seleccionada }}
                onPress={onPress}
                onLongPress={onLongPress}
                testID={`tab-${route.name}`}
                className="items-center justify-center pt-2"
                style={{ minHeight: ALTO_BARRA }}
              >
                <View
                  className="h-8 w-14 items-center justify-center rounded-full"
                  style={{ backgroundColor: seleccionada ? colors["primary-soft"] : "transparent" }}
                >
                  <Icono size={22} color={color} strokeWidth={seleccionada ? 2.4 : 2} />
                </View>
                <Text
                  variante="rotulo"
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.4}
                  className="mt-1"
                  style={{
                    fontFamily: seleccionada ? fontFamilies.bold : fontFamilies.semibold,
                    color: seleccionada ? colors["primary-deep"] : colors.muted,
                  }}
                >
                  {pestana.etiqueta}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// En Android la barra subiría con el teclado y taparía el campo: se oculta mientras está abierto.
function useTecladoAbiertoAndroid() {
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const mostrar = Keyboard.addListener("keyboardDidShow", () => setAbierto(true));
    const ocultar = Keyboard.addListener("keyboardDidHide", () => setAbierto(false));
    return () => {
      mostrar.remove();
      ocultar.remove();
    };
  }, []);
  return abierto;
}
