import { Redirect } from "expo-router";

import { SensorScreen } from "@/features/diagnostico/SensorScreen";

// Solo en desarrollo: comprobar el sensor del efecto holográfico del Pasaporte.
export default function Sensor() {
  if (!__DEV__) return <Redirect href="/" />;
  return <SensorScreen />;
}
