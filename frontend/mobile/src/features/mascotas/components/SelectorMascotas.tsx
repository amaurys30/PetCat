import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";

import type { MascotaConResumen } from "@/api/types";
import { Avatar, Text } from "@/components/ui";
import { colors } from "@/theme/tokens";

type Props = {
  mascotas: MascotaConResumen[];
  actual: number | null;
  onElegir: (id_mascota: number) => void;
  /** Sin conexión no se puede agregar: el botón no aparece. */
  puedeAgregar: boolean;
};

/** Mascotas vivas como un grupo de radios (una elegida) y "+" para agregar. */
export function SelectorMascotas({ mascotas, actual, onElegir, puedeAgregar }: Props) {
  const router = useRouter();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-3 px-pantalla"
    >
      <View accessibilityRole="radiogroup" accessibilityLabel="Elige una mascota" className="flex-row gap-3">
        {mascotas.map((m) => {
          const elegida = m.id_mascota === actual;
          return (
            <Pressable
              key={m.id_mascota}
              accessibilityRole="radio"
              accessibilityLabel={m.nombre}
              accessibilityState={{ checked: elegida }}
              onPress={() => onElegir(m.id_mascota)}
              className="min-h-14 flex-row items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-5"
              style={{
                backgroundColor: elegida ? colors["primary-strong"] : colors.white,
                borderColor: elegida ? colors["primary-strong"] : colors.border,
              }}
            >
              <Avatar nombre={m.nombre} uri={m.foto_miniatura_url} especie={m.especie} tamano="sm" />
              <Text className="font-bold" style={{ color: elegida ? colors.white : colors.ink }}>
                {m.nombre}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {puedeAgregar && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Agregar mascota"
          onPress={() => router.push("/mascotas/nueva")}
          className="h-14 w-14 items-center justify-center rounded-full border border-border bg-white"
        >
          <Plus size={24} color={colors["primary-strong"]} />
        </Pressable>
      )}
    </ScrollView>
  );
}
