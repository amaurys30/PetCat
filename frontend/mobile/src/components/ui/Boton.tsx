import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";

import { colors } from "@/theme/tokens";

// primario: teal fuerte con texto blanco. secundario: borde teal sobre fondo claro.
// claro / contornoClaro: sobre el degradado de marca (pantallas de bienvenida).
const variantes = {
  primario: { caja: "bg-primary", texto: "text-white", spinner: colors.white },
  secundario: { caja: "border-2 border-primary bg-white", texto: "text-primary", spinner: colors.primary },
  claro: { caja: "bg-white", texto: "text-primary-deep", spinner: colors["primary-deep"] },
  contornoClaro: { caja: "border-2 border-white", texto: "text-white", spinner: colors.white },
} as const;

// Deshabilitado: colores propios en vez de opacidad, para no bajar el contraste del texto.
const deshabilitado = { caja: "bg-border", texto: "text-muted", spinner: colors.muted };

type Props = Omit<PressableProps, "children"> & {
  titulo: string;
  variante?: keyof typeof variantes;
  cargando?: boolean;
  className?: string;
};

export function Boton({
  titulo,
  variante = "primario",
  cargando = false,
  disabled,
  className = "",
  ...props
}: Props) {
  const v = disabled ? deshabilitado : variantes[variante];
  const inactivo = !!disabled || cargando;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      disabled={inactivo}
      // min-h-14 = 56 px: por encima del mínimo táctil de 48.
      className={`min-h-14 items-center justify-center rounded-control px-6 active:opacity-80 ${v.caja} ${className}`}
      {...props}
    >
      {cargando ? (
        <ActivityIndicator color={v.spinner} />
      ) : (
        <Text className={`font-negrita text-cuerpo ${v.texto}`}>{titulo}</Text>
      )}
    </Pressable>
  );
}
