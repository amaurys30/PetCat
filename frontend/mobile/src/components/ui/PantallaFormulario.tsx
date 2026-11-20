import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing } from "@/theme/tokens";

type Props = {
  children: ReactNode;
  cabecera?: ReactNode;
  /** Acción principal: queda fija abajo y, con el teclado abierto, justo encima de él. */
  pie?: ReactNode;
};

/** Espacio entre el campo con foco y el teclado (o el pie). */
const MARGEN_CAMPO = 24;
/** Espacio entre el pie y el teclado abierto. */
const MARGEN_PIE = 8;

/**
 * Pantalla con formulario. Con edge-to-edge en Android, KeyboardAvoidingView no alcanza: el
 * desplazamiento lo hace react-native-keyboard-controller (incluido en Expo Go). Al enfocar un
 * campo, la pantalla se desplaza hasta dejarlo visible con margen por encima del teclado y del
 * pie; el pie (botón principal) sube con el teclado. Tocar fuera no cierra el teclado
 * (keyboardShouldPersistTaps) y se respeta el área segura.
 *
 * KeyboardAwareScrollView no es un componente que NativeWind conozca: lleva style con tokens.
 */
export function PantallaFormulario({ children, cabecera, pie }: Props) {
  const insets = useSafeAreaInsets();
  const [altoPie, setAltoPie] = useState(0);
  const espacioAbajo = Math.max(insets.bottom, 12);

  return (
    <View className="flex-1 bg-surface">
      {cabecera}
      <KeyboardAwareScrollView
        bottomOffset={MARGEN_CAMPO + (pie ? altoPie : 0)}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          gap: 20,
          paddingHorizontal: spacing.pantalla,
          paddingTop: cabecera ? 0 : insets.top + 12,
          paddingBottom: pie ? 24 : espacioAbajo + 24,
        }}
      >
        {children}
      </KeyboardAwareScrollView>
      {pie && (
        // Cerrado: deja el área segura abajo. Abierto: el teclado ya la cubre; queda MARGEN_PIE.
        <KeyboardStickyView offset={{ opened: espacioAbajo - MARGEN_PIE }}>
          <View
            onLayout={(e) => setAltoPie(e.nativeEvent.layout.height)}
            className="gap-3 border-t border-border bg-surface px-pantalla pt-3"
            style={{ paddingBottom: espacioAbajo }}
          >
            {pie}
          </View>
        </KeyboardStickyView>
      )}
    </View>
  );
}
