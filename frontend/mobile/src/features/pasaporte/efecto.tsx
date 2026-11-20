import { LinearGradient } from "expo-linear-gradient";
import { useIsFocused } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { AppState, StyleSheet, View } from "react-native";
import Animated, {
  SensorType,
  useAnimatedSensor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";

import { useReducirMovimientoConocido } from "@/lib/movimiento";

// Efecto holográfico del Pasaporte (M3). Decorativo: oculto al lector y sin información.

/**
 * PAUSADO (cierre de M3): hubo cierres nativos de la app en Android con el Pasaporte, también con
 * "Quitar animaciones" activado. Con esto en false la tarjeta tiene solo el brillo fijo y en el
 * Pasaporte no se monta nada de Reanimated (ni el sensor ni el giro 3D). Para retomarlo: ponerlo
 * en true y seguir lo anotado en PLAN.md ("Efecto holográfico del Pasaporte").
 */
export const EFECTO_HOLOGRAFICO = false;

// Batería y rendimiento (cuando está activo):
// - El sensor solo existe mientras el efecto está montado: con la pestaña visible, la app en
//   primer plano y sabiendo ya que no hay "Reducir movimiento". Al salir se desmonta y se apaga.
// - ~30 lecturas por segundo, en el hilo de UI (useAnimatedSensor), sin renders de React.
// - Solo la tarjeta del frente lo tiene.
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

function Degradado() {
  return (
    <LinearGradient
      colors={COLORES_BRILLO}
      locations={[0.3, 0.45, 0.55, 0.7]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}

/** Capa recortada a la forma de la tarjeta, oculta al lector y sin recibir toques. */
function Capa({ radio, children }: { radio: number; children: ReactNode }) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { borderRadius: radio, overflow: "hidden" }]}
    >
      {children}
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
      <Capa radio={radio}>
        <Animated.View
          style={[{ position: "absolute", top: 0, bottom: 0, left: "-50%", width: "200%" }, brillo]}
        >
          <Degradado />
        </Animated.View>
      </Capa>
    </Animated.View>
  );
}

/**
 * Tarjeta con su brillo. Brillo fijo (sin Reanimated: solo View y LinearGradient) salvo que el
 * efecto esté activo (EFECTO_HOLOGRAFICO), sea la tarjeta del frente, la pantalla se vea y ya se
 * sepa que no hay "Reducir movimiento" (antes de la respuesta del sistema no se monta el sensor).
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
  const reducir = useReducirMovimientoConocido();
  if (EFECTO_HOLOGRAFICO && activo && visible && reducir === false) {
    return <ConSensor radio={radio}>{children}</ConSensor>;
  }
  return (
    <View style={{ borderRadius: radio }} testID="pasaporte-efecto-fijo">
      {children}
      <Capa radio={radio}>
        <Degradado />
      </Capa>
    </View>
  );
}
