import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Text } from "@/components/ui";
import { colors } from "@/theme/tokens";

import type { Anillo } from "../logica";

const LADO = 76;
const GROSOR = 8;
const RADIO = (LADO - GROSOR) / 2;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

const COLOR = {
  ok: colors["sello-teal"],
  aviso: colors["sello-sun"],
  alerta: colors["sello-danger"],
} as const;

/** "6/6" en un anillo y, al lado, el estado en texto. Un solo elemento para el lector. */
export function AnilloVacunas({ anillo }: { anillo: Anillo }) {
  const avance = anillo.total === 0 ? 0 : anillo.alDia / anillo.total;
  const color = COLOR[anillo.tono];
  return (
    <View
      accessible
      accessibilityLabel={[anillo.titulo, anillo.detalle].filter(Boolean).join(". ")}
      testID="anillo-vacunas"
      className="flex-row items-center gap-4 rounded-card border p-4"
      style={{ backgroundColor: colors["pasaporte-panel"], borderColor: colors["pasaporte-borde"] }}
    >
      <View style={{ width: LADO, height: LADO }} className="items-center justify-center">
        <Svg width={LADO} height={LADO} style={{ position: "absolute" }}>
          <Circle
            cx={LADO / 2}
            cy={LADO / 2}
            r={RADIO}
            stroke={colors["pasaporte-borde"]}
            strokeWidth={GROSOR}
            fill="none"
          />
          <Circle
            cx={LADO / 2}
            cy={LADO / 2}
            r={RADIO}
            stroke={color}
            strokeWidth={GROSOR}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${CIRCUNFERENCIA} ${CIRCUNFERENCIA}`}
            strokeDashoffset={CIRCUNFERENCIA * (1 - avance)}
            transform={`rotate(-90 ${LADO / 2} ${LADO / 2})`}
          />
        </Svg>
        <Text variante="seccion" className="text-white" maxFontSizeMultiplier={1.2}>
          {`${anillo.alDia}/${anillo.total}`}
        </Text>
      </View>
      <View className="flex-1 gap-1">
        <Text variante="seccion" className="text-white">
          {anillo.titulo}
        </Text>
        {anillo.detalle && (
          <Text
            variante="apoyo"
            style={{ color: anillo.tono === "alerta" ? colors["sello-danger"] : colors["oscuro-muted"] }}
          >
            {anillo.detalle}
          </Text>
        )}
      </View>
    </View>
  );
}
