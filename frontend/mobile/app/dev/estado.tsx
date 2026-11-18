import { Redirect } from "expo-router";

import { EstadoConexionScreen } from "@/features/diagnostico/EstadoConexionScreen";

// Solo en desarrollo.
export default function Estado() {
  if (!__DEV__) return <Redirect href="/" />;
  return <EstadoConexionScreen />;
}
