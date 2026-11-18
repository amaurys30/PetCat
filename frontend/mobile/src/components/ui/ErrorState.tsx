import { CircleAlert, WifiOff } from "lucide-react-native";
import { View } from "react-native";

import { ApiError, MENSAJES } from "@/api/errors";
import { colors } from "@/theme/tokens";

import { Button } from "./Button";
import { Text } from "./Text";

type Props = {
  error?: unknown;
  titulo?: string;
  onReintentar?: () => void;
  reintentando?: boolean;
  className?: string;
};

// Muestra solo el mensaje en español del ApiError; nunca trazas ni códigos internos.
export function ErrorState({ error, titulo, onReintentar, reintentando, className = "" }: Props) {
  const apiError = error instanceof ApiError ? error : null;
  const sinConexion = apiError?.sinConexion ?? false;
  const Icono = sinConexion ? WifiOff : CircleAlert;

  return (
    <View className={`items-center gap-3 px-pantalla py-10 ${className}`} accessibilityLiveRegion="polite">
      <View className="h-20 w-20 items-center justify-center rounded-full bg-danger-soft">
        <Icono size={36} color={colors["danger-ink"]} accessibilityElementsHidden />
      </View>
      <Text variante="seccion" className="text-center">
        {titulo ?? (sinConexion ? "Sin conexión" : "No pudimos cargar esto")}
      </Text>
      <Text className="text-center text-muted">{apiError?.message ?? MENSAJES.generico}</Text>
      {onReintentar && (
        <Button
          titulo="Intentar de nuevo"
          variante="secundario"
          cargando={reintentando}
          onPress={onReintentar}
          className="mt-2 self-stretch"
        />
      )}
    </View>
  );
}
