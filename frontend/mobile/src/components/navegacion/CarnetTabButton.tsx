import { LinearGradient } from "expo-linear-gradient";
import { IdCard } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors, fontFamilies, gradients } from "@/theme/tokens";

export const CIRCULO_CARNET = 64;

type Props = { seleccionada: boolean; onPress: () => void; onLongPress: () => void };

// Botón central elevado. Debe quedar dentro de los límites de su contenedor (ver TabBar):
// en Android la parte de un hijo que sale de su padre no recibe toques.
export function CarnetTabButton({ seleccionada, onPress, onLongPress }: Props) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel="Carnet de mis mascotas"
      accessibilityState={{ selected: seleccionada }}
      onPress={onPress}
      onLongPress={onLongPress}
      testID="tab-carnet"
      className="flex-1 items-center"
    >
      <View
        style={{
          width: CIRCULO_CARNET,
          height: CIRCULO_CARNET,
          borderRadius: CIRCULO_CARNET / 2,
          shadowColor: colors["coral-to"],
          shadowOpacity: 0.35,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
          backgroundColor: colors["coral-to"],
        }}
      >
        <LinearGradient
          colors={gradients.coral.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flex: 1,
            borderRadius: CIRCULO_CARNET / 2,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: seleccionada ? 3 : 0,
            borderColor: colors.white,
          }}
        >
          <IdCard size={28} color={colors["coral-ink"]} strokeWidth={2.2} />
        </LinearGradient>
      </View>
      <Text
        variante="rotulo"
        numberOfLines={1}
        maxFontSizeMultiplier={1.4}
        className="mt-1 text-coral-dark"
        style={{ fontFamily: seleccionada ? fontFamilies.extrabold : fontFamilies.bold }}
      >
        Carnet
      </Text>
    </Pressable>
  );
}
