import "../global.css";

import { useFonts } from "@expo-google-fonts/plus-jakarta-sans";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { queryClient } from "@/lib/queryClient";
import { fuentes } from "@/theme/fuentes";
import { colors } from "@/theme/tokens";

SplashScreen.preventAutoHideAsync();

// La app no usa ImageBackground (fondos: View + Image en posición absoluta). El aviso lo dispara
// NativeWind 4: react-native-css-interop registra ImageBackground al cargarse y RN 0.88 avisa al
// tocarlo. Se calla solo ese aviso en el teléfono; Metro lo imprime una vez en la terminal.
LogBox.ignoreLogs(["ImageBackground is deprecated"]);

export default function RootLayout() {
  const [fuentesListas, errorFuentes] = useFonts(fuentes);
  // Si la fuente falla, la app sigue con la del sistema.
  const listo = fuentesListas || !!errorFuentes;

  useEffect(() => {
    if (listo) SplashScreen.hideAsync();
  }, [listo]);

  if (!listo) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          {/* En M0 la app abre en las pestañas; la sesión (y la bienvenida al inicio) llega en M1. */}
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="dev/estado" />
            <Stack.Screen name="+not-found" />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
