import { CircleAlert, type LucideIcon } from "lucide-react-native";
import { useState, type ComponentRef, type ReactNode, type Ref } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { colors } from "@/theme/tokens";

import { Text } from "./Text";

export type InputProps = TextInputProps & {
  etiqueta: string;
  error?: string;
  ayuda?: string;
  /** Ícono decorativo a la izquierda (correo, candado). */
  icono?: LucideIcon;
  /** Acción a la derecha, dentro del campo (Mostrar contraseña). */
  derecha?: ReactNode;
  ref?: Ref<ComponentRef<typeof TextInput>>;
  className?: string;
};

export function Input({
  etiqueta,
  error,
  ayuda,
  icono: Icono,
  derecha,
  className = "",
  ref,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const [enfocado, setEnfocado] = useState(false);
  // El lector anuncia el error junto con el campo, no solo con el borde rojo.
  const etiquetaAccesible = error ? `${etiqueta}. Error: ${error}` : etiqueta;
  const borde = error ? "border-danger" : enfocado ? "border-primary-strong" : "border-border";

  return (
    <View className={`gap-1.5 ${className}`}>
      <Text variante="apoyo" className="text-ink" importantForAccessibility="no">
        {etiqueta}
      </Text>
      <View className={`min-h-12 flex-row items-center rounded-control border bg-white ${borde}`}>
        {Icono && (
          <View className="pl-4" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Icono size={20} color={colors.muted} />
          </View>
        )}
        <TextInput
          ref={ref}
          accessibilityLabel={etiquetaAccesible}
          placeholderTextColor={colors.subtle}
          className="min-h-12 flex-1 px-4 py-3 font-regular text-cuerpo text-ink"
          onFocus={(e) => {
            setEnfocado(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setEnfocado(false);
            onBlur?.(e);
          }}
          {...props}
        />
        {derecha}
      </View>
      {error ? (
        <View className="flex-row items-center gap-1.5" accessibilityLiveRegion="polite">
          <CircleAlert size={16} color={colors["danger-ink"]} accessibilityElementsHidden />
          <Text variante="apoyo" className="flex-1 text-danger-ink">
            {error}
          </Text>
        </View>
      ) : ayuda ? (
        <Text variante="apoyo" className="text-muted">
          {ayuda}
        </Text>
      ) : null}
    </View>
  );
}
