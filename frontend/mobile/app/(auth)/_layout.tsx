import { Stack } from "expo-router";

// Sin sesión: la bienvenida es la base de la pila (un enlace directo a /login vuelve a ella).
export const unstable_settings = { initialRouteName: "bienvenida" };

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
