import { Cat, Dog, Rabbit, type LucideIcon } from "lucide-react-native";
import { AccessibilityInfo, Pressable, View } from "react-native";

import type { Especie } from "@/api/types";
import { Chip, Text } from "@/components/ui";
import { ESPECIES } from "@/lib/mascotas";
import { colors } from "@/theme/tokens";

const PRINCIPALES: { valor: "perro" | "gato" | "otros"; etiqueta: string; icono: LucideIcon }[] = [
  { valor: "perro", etiqueta: "Perro", icono: Dog },
  { valor: "gato", etiqueta: "Gato", icono: Cat },
  { valor: "otros", etiqueta: "Otro", icono: Rabbit },
];

const OTRAS = ESPECIES.filter((e) => e.valor !== "perro" && e.valor !== "gato");

type Props = { valor: Especie | undefined; onCambiar: (especie: Especie) => void; error?: string };

/** "¿Qué es?": Perro, Gato u Otro; "Otro" despliega las demás especies de la API. */
export function SelectorEspecie({ valor, onCambiar, error }: Props) {
  const grupo = valor === "perro" || valor === "gato" ? valor : valor ? "otros" : undefined;

  const elegir = (opcion: (typeof PRINCIPALES)[number]["valor"]) => {
    if (opcion === "otros") {
      if (grupo !== "otros") onCambiar("conejo");
      AccessibilityInfo.announceForAccessibility("Elige qué animal es: conejo, ave, reptil, roedor, pez u otro");
    } else onCambiar(opcion);
  };

  return (
    <View className="gap-2">
      <Text variante="apoyo" importantForAccessibility="no">
        ¿Qué es?
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={error ? `¿Qué es? Error: ${error}` : "¿Qué es?"}
        className="flex-row gap-3"
      >
        {PRINCIPALES.map(({ valor: opcion, etiqueta, icono: Icono }) => {
          const marcado = grupo === opcion;
          return (
            <Pressable
              key={opcion}
              accessibilityRole="radio"
              accessibilityLabel={etiqueta}
              accessibilityState={{ checked: marcado }}
              onPress={() => elegir(opcion)}
              className={`min-h-24 flex-1 items-center justify-center gap-1 rounded-card border-2 ${
                marcado ? "border-primary-strong bg-primary-soft" : "border-border bg-white"
              }`}
            >
              <Icono size={32} color={marcado ? colors["primary-deep"] : colors.muted} />
              <Text className={marcado ? "font-bold text-primary-deep" : "text-ink"}>{etiqueta}</Text>
            </Pressable>
          );
        })}
      </View>
      {grupo === "otros" && (
        <View accessibilityRole="radiogroup" accessibilityLabel="¿Qué animal es?" className="flex-row flex-wrap gap-2 pt-1">
          {OTRAS.map((e) => (
            <Chip key={e.valor} etiqueta={e.etiqueta} seleccionado={valor === e.valor} onPress={() => onCambiar(e.valor)} />
          ))}
        </View>
      )}
      {error && (
        <Text variante="apoyo" className="text-danger-ink" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
}
