import { CircleAlert, Hourglass, Check, type LucideIcon } from "lucide-react-native";
import { View } from "react-native";

import { Text } from "@/components/ui";
import { colors } from "@/theme/tokens";

import { etiquetaSello, textoSello, type EstadoSello, type Sello, type TonoSello } from "../logica";

const COLOR: Record<TonoSello, string> = {
  teal: colors["sello-teal"],
  coral: colors["sello-coral"],
  lavender: colors["sello-lavender"],
  info: colors["sello-info"],
  sun: colors["sello-sun"],
  danger: colors["sello-danger"],
  memoria: colors["sello-memoria"],
};
const ICONO: Record<EstadoSello, LucideIcon> = { aplicada: Check, proxima: Hourglass, vencida: CircleAlert };

export const LADO_SELLO = 96;

/**
 * Sello de vacunación sobre el fondo oscuro. El dibujo (círculo punteado, inclinación, ícono) es
 * decorativo; el sello es un solo elemento con todo el dato en texto para el lector. Vencida:
 * borde continuo además del color (el estado nunca va solo en color).
 */
export function SelloVacuna({ sello, indice }: { sello: Sello; indice: number }) {
  const color = COLOR[sello.tono];
  const Icono = ICONO[sello.estado];
  // Inclinación decorativa alternada, como sellos de verdad.
  const giro = [-6, 4, -3, 7][indice % 4];
  return (
    <View
      accessible
      accessibilityLabel={etiquetaSello(sello)}
      testID={`sello-${sello.clave}`}
      className="items-center justify-center rounded-full"
      style={{
        width: LADO_SELLO,
        height: LADO_SELLO,
        borderWidth: 2.5,
        borderStyle: sello.estado === "vencida" ? "solid" : "dashed",
        borderColor: color,
        transform: [{ rotate: `${giro}deg` }],
      }}
    >
      <Icono size={18} color={color} strokeWidth={2.6} />
      <Text
        variante="apoyo"
        className="font-extrabold"
        style={{ color }}
        maxFontSizeMultiplier={1.2}
        numberOfLines={1}
      >
        {sello.corto}
      </Text>
      <Text variante="rotulo" style={{ color }} maxFontSizeMultiplier={1.2} numberOfLines={1}>
        {textoSello(sello)}
      </Text>
    </View>
  );
}
