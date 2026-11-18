import { useEffect, useState } from "react";
import { Animated, View } from "react-native";

import { useReducirMovimiento } from "@/lib/movimiento";

type Props = { className?: string };

/** Bloque gris de carga. Late suave salvo con "Reducir movimiento". Oculto a lectores. */
export function Skeleton({ className = "" }: Props) {
  const reducir = useReducirMovimiento();
  const [opacidad] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reducir) {
      opacidad.setValue(1);
      return;
    }
    const pulso = Animated.loop(
      Animated.sequence([
        Animated.timing(opacidad, { toValue: 0.5, duration: 700, useNativeDriver: true }),
        Animated.timing(opacidad, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulso.start();
    return () => pulso.stop();
  }, [reducir, opacidad]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ opacity: opacidad }}
      className={`rounded-chip bg-track ${className}`}
    />
  );
}

/** Lista de carga: los lectores anuncian "Cargando" una vez en lugar de cada bloque. */
export function SkeletonLista({ filas = 3, etiqueta = "Cargando" }: { filas?: number; etiqueta?: string }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={etiqueta}
      className="gap-3 px-pantalla"
    >
      {Array.from({ length: filas }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-card" />
      ))}
    </View>
  );
}
