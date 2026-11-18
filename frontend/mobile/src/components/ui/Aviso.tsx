import { CircleAlert, Info, Lightbulb, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";

import { colors } from "@/theme/tokens";

import { Text } from "./Text";

// Tonos con texto AA sobre su fondo: sun-ink/sun-soft 5,1:1; danger-ink/danger-soft 5,7:1;
// info-ink/info-soft 5,4:1.
const tonos = {
  consejo: { caja: "bg-sun-soft", texto: "text-sun-ink", color: colors["sun-ink"], icono: Lightbulb },
  error: {
    caja: "bg-danger-soft",
    texto: "text-danger-ink",
    color: colors["danger-ink"],
    icono: CircleAlert,
  },
  info: { caja: "bg-info-soft", texto: "text-info-ink", color: colors["info-ink"], icono: Info },
} as const;

type Props = {
  tono: keyof typeof tonos;
  children: string;
  /** Acción debajo del texto (un enlace o botón). */
  accion?: ReactNode;
  icono?: LucideIcon;
  className?: string;
};

/**
 * Caja de aviso. En los errores, el texto lleva role alert y la caja es región viva (Android).
 * El rol va en el texto y no en la caja: así la acción (un enlace) sigue siendo un elemento
 * aparte para el lector, en lugar de quedar agrupada dentro de la alerta.
 */
export function Aviso({ tono, children, accion, icono, className = "" }: Props) {
  const t = tonos[tono];
  const Icono = icono ?? t.icono;
  return (
    <View
      accessibilityLiveRegion={tono === "error" ? "assertive" : undefined}
      className={`flex-row gap-3 rounded-card p-4 ${t.caja} ${className}`}
    >
      <Icono size={20} color={t.color} accessibilityElementsHidden />
      <View className="flex-1 gap-2">
        <Text variante="apoyo" accessibilityRole={tono === "error" ? "alert" : undefined} className={t.texto}>
          {children}
        </Text>
        {accion}
      </View>
    </View>
  );
}
