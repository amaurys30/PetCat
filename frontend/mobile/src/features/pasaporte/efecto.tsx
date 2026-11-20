import { LinearGradient } from "expo-linear-gradient";
import { useIsFocused } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { AppState, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  SensorType,
  useAnimatedSensor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";

import { useReducirMovimiento } from "@/lib/movimiento";

// Efecto holográfico del Pasaporte (M3). Decorativo: oculto al lector y sin información.
//
// Batería y rendimiento:
// - El sensor solo existe mientras el efecto está montado: con la pestaña visible, la app en
//   primer plano y sin "Reducir movimiento". Al salir se desmonta y Reanimated lo apaga.
// - ~30 lecturas por segundo, en el hilo de UI (useAnimatedSensor): sin pasar por JavaScript
//   ni provocar renders de React.
// - Solo la tarjeta del frente lo tiene.
//
// Si el sensor no existe (o no responde en el dispositivo), queda el brillo fijo.
// Para cambiar a expo-sensors basta reemplazar useInclinacion.

const INTERVALO_MS = 33; // ~30 Hz
const GRADOS_MAX = 6;
const RECORRIDO_BRILLO = 0.35; // fracción del ancho que se mueve el brillo
const GRAVEDAD = 9.81;

const RESORTE = { damping: 18, stiffness: 120, mass: 0.6 };

/** Inclinación del teléfono entre -1 y 1 en cada eje, relativa a cómo se sostenía al empezar. */
export function useInclinacion(): { x: SharedValue<number>; y: SharedValue<number>; disponible: boolean } {
  const sensor = useAnimatedSensor(SensorType.GRAVITY, { interval: INTERVALO_MS });
  // Ángulo vertical con el que se sostenía el teléfono en la primera lectura: el brillo se mueve
  // respecto a esa posición, no a la vertical.
  const base = useSharedValue<number | null>(null);

  // Se recalculan en el hilo de UI con cada lectura del sensor.
  const x = useDerivedValue(() => Math.max(-1, Math.min(1, sensor.sensor.value.x / (GRAVEDAD / 2))));
  const y = useDerivedValue(() => {
    const g = sensor.sensor.value;
    if (base.value === null && (g.x !== 0 || g.y !== 0)) base.value = g.y;
    return Math.max(-1, Math.min(1, (g.y - (base.value ?? g.y)) / (GRAVEDAD / 2)));
  });

  return { x, y, disponible: sensor.isAvailable };
}

/** true mientras la pantalla está visible y la app en primer plano. */
export function useVisible(): boolean {
  const enfocada = useIsFocused();
  // Al arrancar el estado puede ser "unknown": cuenta como activa salvo en segundo plano o inactiva.
  const esActiva = (estado: string | null | undefined) => estado !== "background" && estado !== "inactive";
  const [activa, setActiva] = useState(esActiva(AppState.currentState));
  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => setActiva(esActiva(estado)));
    return () => sub.remove();
  }, []);
  return enfocada && activa;
}

const COLORES_BRILLO = [
  "rgba(255,255,255,0)",
  "rgba(255,255,255,0.18)",
  "rgba(180,255,240,0.10)",
  "rgba(255,255,255,0)",
] as const;

function Brillo({ estilo }: { estilo?: StyleProp<ViewStyle> | ReturnType<typeof useAnimatedStyle> }) {
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        style={[{ position: "absolute", top: 0, bottom: 0, left: "-50%", width: "200%" }, estilo]}
      >
        <LinearGradient
          colors={COLORES_BRILLO}
          locations={[0.3, 0.45, 0.55, 0.7]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

function ConSensor({ children, radio }: { children: ReactNode; radio: number }) {
  const { x, y } = useInclinacion();
  const tarjeta = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateY: `${withSpring(x.value * GRADOS_MAX, RESORTE)}deg` },
      { rotateX: `${withSpring(-y.value * GRADOS_MAX, RESORTE)}deg` },
    ],
  }));
  const brillo = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(x.value * RECORRIDO_BRILLO * 300, RESORTE) }],
  }));
  return (
    <Animated.View style={[{ borderRadius: radio }, tarjeta]} testID="pasaporte-efecto-activo">
      {children}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radio, overflow: "hidden" }]}
      >
        <Brillo estilo={brillo} />
      </View>
    </Animated.View>
  );
}

/**
 * Tarjeta con efecto holográfico. `activo` = es la tarjeta del frente. El sensor solo se monta si
 * además la pantalla se ve y no hay "Reducir movimiento"; si no, brillo fijo.
 */
export function Holograma({
  children,
  activo,
  radio,
}: {
  children: ReactNode;
  activo: boolean;
  radio: number;
}) {
  const visible = useVisible();
  const reducir = useReducirMovimiento();
  if (activo && visible && !reducir) return <ConSensor radio={radio}>{children}</ConSensor>;
  return (
    <View style={{ borderRadius: radio }} testID="pasaporte-efecto-fijo">
      {children}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radio, overflow: "hidden" }]}
      >
        <Brillo />
      </View>
    </View>
  );
}
