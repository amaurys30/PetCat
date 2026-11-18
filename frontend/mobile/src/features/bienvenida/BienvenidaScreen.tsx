import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { CalendarDays, Dog, PawPrint, Syringe } from "lucide-react-native";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, Text } from "@/components/ui";
import { colors, gradients } from "@/theme/tokens";

// M1 · Bienvenida, estática en M0 (el carrusel de 3 y el arranque con sesión llegan en M1).
// El texto blanco va en la mitad inferior, donde el degradado ya es primary-strong o más oscuro.
export function BienvenidaScreen() {
  const router = useRouter();

  return (
    <LinearGradient colors={gradients.brand.colors} locations={gradients.brand.locations} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerClassName="grow justify-between px-pantalla pb-6">
          <Ilustracion />

          <View className="gap-4">
            <Text variante="hero" className="text-white">
              Todo lo de tu mascota, en tu bolsillo.
            </Text>
            <Text className="text-white">
              Su carnet de vacunas, sus citas y las veterinarias de Sincelejo, en un solo lugar.
            </Text>
            <View className="mt-4 gap-3">
              <Button variante="claro" titulo="Crear mi cuenta" onPress={() => router.push("/registro")} />
              <Button
                variante="contornoClaro"
                titulo="Ya tengo cuenta"
                onPress={() => router.push("/login")}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// Decorativa: se oculta a los lectores de pantalla, que ya leen el título.
function Ilustracion() {
  return (
    <View
      className="h-80 items-center justify-center"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View className="h-72 w-72 items-center justify-center rounded-full bg-white/10">
        <View className="h-52 w-52 items-center justify-center rounded-full bg-white/15">
          <View className="h-36 w-36 items-center justify-center rounded-full bg-white">
            <Dog size={72} color={colors["primary-strong"]} strokeWidth={1.75} />
          </View>
        </View>
      </View>
      <Etiqueta
        className="absolute right-0 top-8"
        icono={<Syringe size={16} color={colors["primary-strong"]} />}
      >
        Vacuna al día
      </Etiqueta>
      <Etiqueta
        className="absolute bottom-12 left-0"
        icono={<CalendarDays size={16} color={colors["primary-strong"]} />}
      >
        Mañana · 8:00
      </Etiqueta>
      <View className="absolute bottom-10 right-6 h-14 w-14 items-center justify-center rounded-full bg-sun">
        <PawPrint size={24} color={colors.ink} />
      </View>
    </View>
  );
}

function Etiqueta({ icono, children, className }: { icono: ReactNode; children: string; className: string }) {
  return (
    <View className={`flex-row items-center gap-2 rounded-full bg-white px-4 py-2 ${className}`}>
      {icono}
      <Text variante="apoyo" className="font-bold text-primary-deep">
        {children}
      </Text>
    </View>
  );
}
