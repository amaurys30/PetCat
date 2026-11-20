import { Check, CircleAlert, Hourglass, type LucideIcon } from "lucide-react-native";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

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

export const LADO_SELLO = 84;
const GROSOR = 2.5;

/**
 * Sello de vacunación sobre el fondo oscuro: círculo (punteado; continuo si está vencida, así el
 * estado no va solo en color) con el ícono y la fecha o el plazo, y debajo el nombre completo.
 * El círculo es SVG: los bordes punteados con borderRadius y giro dan problemas en Android.
 * Para el lector es un solo elemento con todo el dato en texto.
 */
export function SelloVacuna({ sello }: { sello: Sello }) {
  const color = COLOR[sello.tono];
  const Icono = ICONO[sello.estado];
  const radio = (LADO_SELLO - GROSOR) / 2;
  return (
    <View
      accessible
      accessibilityLabel={etiquetaSello(sello)}
      testID={`sello-${sello.clave}`}
      className="items-center gap-1.5"
    >
      <View style={{ width: LADO_SELLO, height: LADO_SELLO }} className="items-center justify-center gap-0.5">
        <Svg width={LADO_SELLO} height={LADO_SELLO} style={{ position: "absolute" }}>
          <Circle
            cx={LADO_SELLO / 2}
            cy={LADO_SELLO / 2}
            r={radio}
            stroke={color}
            strokeWidth={GROSOR}
            strokeDasharray={sello.estado === "vencida" ? undefined : "6 5"}
            fill="none"
          />
        </Svg>
        <Icono size={20} color={color} strokeWidth={2.6} />
        <Text
          variante="rotulo"
          className="font-bold"
          style={{ color }}
          maxFontSizeMultiplier={1.2}
          numberOfLines={1}
        >
          {textoSello(sello)}
        </Text>
      </View>
      <Text variante="apoyo" className="text-center font-bold" style={{ color }} numberOfLines={2}>
        {sello.nombre}
      </Text>
    </View>
  );
}
