import { Tabs } from "expo-router/js-tabs";

import { TabBar } from "@/components/navegacion/TabBar";
import { colors } from "@/theme/tokens";

// El orden de las pantallas es el orden de las pestañas (y del foco de los lectores).
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.surface } }}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio" }} />
      <Tabs.Screen name="explorar" options={{ title: "Explorar" }} />
      <Tabs.Screen name="carnet" options={{ title: "Carnet" }} />
      <Tabs.Screen name="citas" options={{ title: "Citas" }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
