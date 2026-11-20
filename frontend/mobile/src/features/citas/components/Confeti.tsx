import { useEffect, useState } from "react";
import { Animated, Easing, View, useWindowDimensions } from "react-native";

import { useReducirMovimientoConocido } from "@/lib/movimiento";
import { colors } from "@/theme/tokens";

const COLORES = [colors.sun, colors.lavender, colors.primary, colors.coral, colors.info];
// Posición horizontal (fracción del ancho), retraso y giro de cada pieza: fijos, sin azar.
const PIEZAS = [0.06, 0.16, 0.27, 0.38, 0.5, 0.61, 0.72, 0.83, 0.93, 0.11, 0.44, 0.78].map((x, i) => ({
  x,
  retraso: (i % 4) * 120,
  giro: i % 2 === 0 ? 1 : -1,
  color: COLORES[i % COLORES.length]!,
}));

/**
 * Confeti de la confirmación: una sola caída de 1,6 s con Animated de React Native (sin
 * Reanimated, ver el pendiente del Pasaporte). No se monta con "Reducir movimiento" ni mientras
 * el sistema no responde. Es decorativo: oculto a los lectores y sin recibir toques.
 */
export function Confeti() {
  const reducir = useReducirMovimientoConocido();
  if (reducir !== false) return null;
  return <Caida />;
}

function Caida() {
  const { width, height } = useWindowDimensions();
  const [progreso] = useState(() => PIEZAS.map(() => new Animated.Value(0)));

  useEffect(() => {
    const animacion = Animated.stagger(
      60,
      progreso.map((v, i) =>
        Animated.timing(v, {
          toValue: 1,
          duration: 1600,
          delay: PIEZAS[i]!.retraso,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    );
    animacion.start();
    return () => animacion.stop();
  }, [progreso]);

  return (
    <View
      testID="confeti"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {PIEZAS.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: p.x * width,
            top: -20,
            width: 10,
            height: 18,
            borderRadius: 4,
            backgroundColor: p.color,
            opacity: progreso[i]!.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
            transform: [
              {
                translateY: progreso[i]!.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.45] }),
              },
              {
                rotate: progreso[i]!.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", `${p.giro * 220}deg`],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}
