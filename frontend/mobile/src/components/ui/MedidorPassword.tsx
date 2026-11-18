import { View } from "react-native";

import { Text } from "./Text";

export type NivelPassword = 0 | 1 | 2 | 3;

const ETIQUETAS = ["Débil", "Débil", "Buena", "Fuerte"] as const;

/**
 * Nivel orientativo (la regla real es la de la API: 8 a 72 caracteres con letra y número).
 * 1 punto por llegar a 8, 1 por mezclar letras y números, 1 por 12+ o mayúsculas y símbolos.
 */
export function nivelPassword(password: string): NivelPassword {
  if (!password) return 0;
  let nivel = 0;
  if (password.length >= 8) nivel++;
  if (/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(password) && /\d/.test(password)) nivel++;
  if (password.length >= 12 || (/[A-ZÁÉÍÓÚÜÑ]/.test(password) && /[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]/.test(password)))
    nivel++;
  return Math.min(nivel, 3) as NivelPassword;
}

/** Tres barras y el nivel en texto (el estado nunca solo con color). */
export function MedidorPassword({ password }: { password: string }) {
  if (!password) return null;
  const nivel = nivelPassword(password);
  const etiqueta = ETIQUETAS[nivel];
  return (
    <View
      className="flex-row items-center gap-2"
      accessible
      accessibilityLabel={`Seguridad de la contraseña: ${etiqueta}`}
    >
      {[1, 2, 3].map((barra) => (
        <View
          key={barra}
          className={`h-1.5 flex-1 rounded-full ${barra <= nivel ? (nivel >= 2 ? "bg-primary-strong" : "bg-danger") : "bg-track"}`}
        />
      ))}
      <Text
        variante="apoyo"
        className={`w-14 text-right font-bold ${nivel >= 2 ? "text-primary-strong" : "text-danger-ink"}`}
      >
        {etiqueta}
      </Text>
    </View>
  );
}
