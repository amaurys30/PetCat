import "../global.css";

import { useFonts } from "@expo-google-fonts/plus-jakarta-sans";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SinConexionScreen } from "@/features/sesion/SinConexionScreen";
import { useArranque } from "@/features/sesion/useArranque";
import { queryClient } from "@/lib/queryClient";
import { suscribirCache } from "@/lib/cachePersistente";
import { useIdUsuario, useSesion } from "@/store/sesion";
import { fuentes } from "@/theme/fuentes";
import { colors } from "@/theme/tokens";

SplashScreen.preventAutoHideAsync();

// La app no usa ImageBackground (fondos: View + Image en posición absoluta). El aviso lo dispara
// NativeWind 4: react-native-css-interop registra ImageBackground al cargarse y RN 0.88 avisa al
// tocarlo. Se calla solo ese aviso en el teléfono; Metro lo imprime una vez en la terminal.
LogBox.ignoreLogs(["ImageBackground is deprecated"]);

export default function RootLayout() {
  const [fuentesListas, errorFuentes] = useFonts(fuentes);
  const arranque = useArranque();
  // Si la fuente falla, la app sigue con la del sistema. El splash sigue hasta saber si hay sesión.
  const listo = (fuentesListas || !!errorFuentes) && arranque.fase !== "cargando";

  useEffect(() => {
    if (listo) SplashScreen.hideAsync();
  }, [listo]);

  if (!listo) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="dark" />
            {arranque.fase === "sin_conexion" ? (
              <SinConexionScreen onReintentar={arranque.reintentar} reintentando={arranque.reintentando} />
            ) : (
              <Navegacion />
            )}
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Rutas protegidas por el estado de la sesión: sin sesión, solo (auth) (bienvenida, registro,
 * login, recuperar); con sesión y la política pendiente, solo aceptarla; con sesión, el resto.
 * Al cambiar la sesión (login, cerrar sesión, aceptar), Expo Router redirige solo.
 */
function Navegacion() {
  const autenticada = useSesion((s) => s.estado === "autenticada");
  const requierePolitica = useSesion((s) => s.requierePolitica);
  const recienRegistrado = useSesion((s) => s.recienRegistrado);
  const id_usuario = useIdUsuario();

  // Con sesión, las consultas de mascotas se guardan en el teléfono (24 h) para abrir sin red.
  useEffect(() => {
    if (!id_usuario) return;
    return suscribirCache(id_usuario);
  }, [id_usuario]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Protected
        guard={autenticada && !requierePolitica}
        redirectTo={autenticada ? "/aceptar-politica" : "/bienvenida"}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="mascotas" />
        <Stack.Screen name="verificar-correo" />
      </Stack.Protected>
      <Stack.Protected guard={autenticada && requierePolitica} redirectTo={autenticada ? "/" : "/bienvenida"}>
        <Stack.Screen name="aceptar-politica" />
      </Stack.Protected>
      <Stack.Protected guard={!autenticada} redirectTo={recienRegistrado ? "/verificar-correo" : "/"}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="politica" />
      <Stack.Screen name="dev/estado" />
      <Stack.Screen name="dev/sensor" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
