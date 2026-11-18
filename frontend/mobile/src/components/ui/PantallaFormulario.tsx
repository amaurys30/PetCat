import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = { children: ReactNode; cabecera?: ReactNode; pie?: ReactNode };

/**
 * Pantalla con formulario: el teclado no tapa el campo con foco (KeyboardAvoidingView +
 * desplazamiento), tocar fuera no se pierde (keyboardShouldPersistTaps) y respeta el área segura.
 */
export function PantallaFormulario({ children, cabecera, pie }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-surface"
    >
      {cabecera}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="grow gap-5 px-pantalla pb-6"
        contentContainerStyle={{ paddingTop: cabecera ? 0 : insets.top + 12 }}
      >
        {children}
      </ScrollView>
      {pie && <View style={{ paddingBottom: Math.max(insets.bottom, 12) }}>{pie}</View>}
    </KeyboardAvoidingView>
  );
}
