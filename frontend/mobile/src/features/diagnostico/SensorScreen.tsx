import { useRef, useState } from "react";
import { View } from "react-native";
import { runOnJS, useAnimatedReaction } from "react-native-reanimated";

import { Card, ScreenHeader, Text } from "@/components/ui";
import { useInclinacion } from "@/features/pasaporte/efecto";
import { RESPALDO } from "@/lib/navegacion";

/**
 * Solo en desarrollo: confirma en el teléfono (Expo Go o development build) que useAnimatedSensor
 * entrega lecturas. Si "Lecturas" no sube al inclinar el teléfono, el efecto del Pasaporte debe
 * pasar a expo-sensors (solo cambia useInclinacion en features/pasaporte/efecto.tsx).
 */
export function SensorScreen() {
  const { x, y, disponible } = useInclinacion();
  const [lectura, setLectura] = useState({ x: 0, y: 0, n: 0 });
  const ultima = useRef(0);

  const mostrar = (nx: number, ny: number) => {
    const ahora = Date.now();
    // 5 veces por segundo basta para leerlo.
    if (ahora - ultima.current < 200) return;
    ultima.current = ahora;
    setLectura((l) => ({ x: nx, y: ny, n: l.n + 1 }));
  };

  useAnimatedReaction(
    () => [x.value, y.value] as const,
    ([nx, ny]) => runOnJS(mostrar)(nx, ny),
  );

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader titulo="Sensor" subtitulo="Solo en desarrollo" volverA={RESPALDO.perfil} />
      <View className="gap-4 px-pantalla">
        <Card className="gap-2">
          <Text>{`Disponible: ${disponible ? "sí" : "no (o todavía no se registró)"}`}</Text>
          <Text>{`Lecturas: ${lectura.n}`}</Text>
          <Text>{`Inclinación lateral (x): ${lectura.x.toFixed(2)}`}</Text>
          <Text>{`Inclinación vertical (y): ${lectura.y.toFixed(2)}`}</Text>
        </Card>
        <Text className="text-muted">
          Inclina el teléfono a los lados y hacia adelante: los valores deben moverse entre -1 y 1 y las
          lecturas, subir.
        </Text>
      </View>
    </View>
  );
}
