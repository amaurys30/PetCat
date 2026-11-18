import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { CalendarDays, Dog, PawPrint, Syringe } from "lucide-react-native";
import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Boton } from "@/components/ui/Boton";
import { Texto } from "@/components/ui/Texto";
import { colors, degradadoMarca } from "@/theme/tokens";

// Pantalla M1 (Bienvenida). En la fase M0 es estática: el carrusel de tres láminas llega
// con el acceso, junto con Crear cuenta (M2) e Iniciar sesión (M3).
export function BienvenidaScreen() {
  const router = useRouter();

  return (
    <LinearGradient colors={degradadoMarca.colors} locations={degradadoMarca.locations} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerClassName="grow justify-between px-6 pb-6">
          <Ilustracion />

          <View className="gap-4">
            <Texto variante="hero" className="text-white">
              Todo lo de tu mascota, en tu bolsillo.
            </Texto>
            <Texto className="text-white">
              Su carnet de vacunas, sus citas y las veterinarias de Sincelejo, en un solo lugar.
            </Texto>

            <View className="mt-4 gap-3">
              <Boton variante="claro" titulo="Crear mi cuenta" onPress={() => router.push("/registro")} />
              <Boton
                variante="contornoClaro"
                titulo="Ya tengo cuenta"
                onPress={() => router.push("/login")}
              />
            </View>

            {__DEV__ && (
              <Link
                href="/dev/estado"
                accessibilityRole="link"
                className="min-h-12 self-center px-4 py-3 text-center font-medio text-apoyo text-white underline"
              >
                Diagnóstico de la conexión
              </Link>
            )}
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
            <Dog size={72} color={colors.primary} strokeWidth={1.75} />
          </View>
        </View>
      </View>

      <Chip className="absolute right-0 top-8" icono={<Syringe size={16} color={colors.primary} />}>
        Vacuna al día
      </Chip>
      <Chip className="absolute bottom-12 left-0" icono={<CalendarDays size={16} color={colors.primary} />}>
        Mañana · 8:00
      </Chip>
      <View className="absolute bottom-10 right-6 h-14 w-14 items-center justify-center rounded-full bg-sol">
        <PawPrint size={24} color={colors.ink} />
      </View>
    </View>
  );
}

function Chip({ icono, children, className }: { icono: ReactNode; children: string; className: string }) {
  return (
    <View className={`flex-row items-center gap-2 rounded-full bg-white px-4 py-2 ${className}`}>
      {icono}
      <Text className="font-negrita text-apoyo text-primary-deep">{children}</Text>
    </View>
  );
}
