import { useRouter, type Href } from "expo-router";

// Rutas de respaldo cuando no hay historial (pantalla abierta por enlace o tras recargar Metro,
// que reabre la última URL sin nada debajo).
export const RESPALDO = {
  inicio: "/",
  perfil: "/perfil",
} as const satisfies Record<string, Href>;

type Navegador = { canGoBack: () => boolean; back: () => void; replace: (href: Href) => void };

/** Vuelve si hay a dónde; si no, reemplaza por la ruta de respaldo (sin GO_BACK sin manejar). */
export function volverOIr(router: Navegador, respaldo: Href = RESPALDO.inicio) {
  if (router.canGoBack()) router.back();
  else router.replace(respaldo);
}

/** Todos los "Volver" y las flechas de ScreenHeader usan este hook. */
export function useVolver(respaldo: Href = RESPALDO.inicio) {
  const router = useRouter();
  return () => volverOIr(router, respaldo);
}
