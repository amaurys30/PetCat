import { View } from "react-native";

// Mock propio de react-native-reanimated para Jest (se usa a través de test/reanimated.ts). El oficial (react-native-reanimated/mock)
// carga partes de la librería real que en Jest fallan sin el runtime nativo de worklets.
// Cubre solo lo que usa la app (efecto del Pasaporte y la pantalla del sensor); si se usa algo
// más de Reanimated, agregarlo aquí.

type Valor<T> = { value: T; get: () => T; set: (v: T) => void };

const valor = <T,>(inicial: T): Valor<T> => {
  const v = {
    value: inicial,
    get: () => v.value,
    set: (nuevo: T) => {
      v.value = nuevo;
    },
  };
  return v;
};

export const SensorType = { ACCELEROMETER: 1, GYROSCOPE: 2, GRAVITY: 3, MAGNETIC_FIELD: 4, ROTATION: 5 };

/** Cuántas veces se montó un sensor y cuántos siguen activos (para las pruebas del efecto). */
export const sensores = { montados: 0, activos: 0 };

export function useAnimatedSensor() {
  const { useEffect } = jest.requireActual<typeof import("react")>("react");
  useEffect(() => {
    sensores.montados += 1;
    sensores.activos += 1;
    return () => {
      sensores.activos -= 1;
    };
  }, []);
  return {
    sensor: valor({ x: 0, y: 0, z: 0, interfaceOrientation: 0 }),
    unregister: () => undefined,
    isAvailable: true,
    config: { interval: 33, adjustToInterfaceOrientation: true, iosReferenceFrame: 0 },
  };
}

export const useSharedValue = <T,>(inicial: T) => valor(inicial);
export const useDerivedValue = <T,>(calcular: () => T) => valor(calcular());
export const useAnimatedStyle = (estilo: () => object) => estilo();
export const useAnimatedReaction = () => undefined;
export const withSpring = <T,>(destino: T) => destino;
export const withTiming = <T,>(destino: T) => destino;
export const runOnJS =
  <A extends unknown[], R>(fn: (...args: A) => R) =>
  (...args: A) =>
    fn(...args);

const Animated = { View, createAnimatedComponent: <C,>(c: C) => c };
export default Animated;
