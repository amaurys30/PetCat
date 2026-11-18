import type { LucideIcon } from "lucide-react-native";
import { ActivityIndicator, Pressable, View, type PressableProps } from "react-native";

import { colors } from "@/theme/tokens";

import { Text } from "./Text";

// primario, secundario, suave y peligro (plan M0). claro y contornoClaro: solo sobre el
// degradado de marca (bienvenida). Deshabilitado con colores propios, no con opacidad.
const variantes = {
  primario: { caja: "bg-primary-strong", texto: "text-white", color: colors.white },
  secundario: {
    caja: "border-2 border-primary-strong bg-white",
    texto: "text-primary-strong",
    color: colors["primary-strong"],
  },
  suave: { caja: "bg-primary-soft", texto: "text-primary-deep", color: colors["primary-deep"] },
  peligro: { caja: "bg-danger-ink", texto: "text-white", color: colors.white },
  claro: { caja: "bg-white", texto: "text-primary-deep", color: colors["primary-deep"] },
  contornoClaro: { caja: "border-2 border-white", texto: "text-white", color: colors.white },
} as const;

const deshabilitado = { caja: "bg-track", texto: "text-muted", color: colors.muted };

export type VarianteBoton = keyof typeof variantes;

type Props = Omit<PressableProps, "children"> & {
  titulo: string;
  variante?: VarianteBoton;
  icono?: LucideIcon;
  cargando?: boolean;
  className?: string;
};

export function Button({
  titulo,
  variante = "primario",
  icono: Icono,
  cargando = false,
  disabled,
  className = "",
  accessibilityLabel,
  ...props
}: Props) {
  const v = disabled ? deshabilitado : variantes[variante];
  const inactivo = !!disabled || cargando;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? titulo}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      disabled={inactivo}
      className={`min-h-12 flex-row items-center justify-center gap-2 rounded-control px-5 py-3 active:opacity-80 ${v.caja} ${className}`}
      {...props}
    >
      {cargando ? (
        <ActivityIndicator color={v.color} />
      ) : (
        <View className="flex-row items-center gap-2">
          {Icono && <Icono size={20} color={v.color} accessibilityElementsHidden />}
          <Text variante="cuerpo" className={`font-bold ${v.texto}`}>
            {titulo}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
