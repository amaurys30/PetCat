import { Eye, EyeOff, Lock } from "lucide-react-native";
import { useState } from "react";
import { Pressable } from "react-native";

import { colors } from "@/theme/tokens";

import { Input, type InputProps } from "./Input";

type Props = Omit<InputProps, "secureTextEntry" | "derecha" | "icono"> & {
  /** "nueva" (registro, restablecer) o "actual" (login): cambia el autocompletado del sistema. */
  tipo: "nueva" | "actual";
};

export function PasswordInput({ tipo, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const Ojo = visible ? EyeOff : Eye;

  return (
    <Input
      icono={Lock}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete={tipo === "nueva" ? "new-password" : "current-password"}
      textContentType={tipo === "nueva" ? "newPassword" : "password"}
      // iOS propone una contraseña que cumple las reglas de la API (8+, letra y número).
      passwordRules={tipo === "nueva" ? "minlength: 8; required: lower; required: digit;" : undefined}
      derecha={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          onPress={() => setVisible((v) => !v)}
          className="h-12 w-12 items-center justify-center"
        >
          <Ojo size={20} color={colors.muted} />
        </Pressable>
      }
      {...props}
    />
  );
}
