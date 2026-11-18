import { Redirect } from "expo-router";

import { EstadoConexionScreen } from "@/features/diagnostico/screens/EstadoConexionScreen";

// Solo en desarrollo.
export default function Estado() {
  if (!__DEV__) return <Redirect href="/" />;
  return <EstadoConexionScreen />;
}
