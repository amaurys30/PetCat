import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { crearQueryClient } from "@/lib/queryClient";

const metricas = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Render con los proveedores de la app y un QueryClient nuevo, sin reintentos. */
export function renderConProveedores(ui: ReactElement) {
  const client = crearQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <SafeAreaProvider initialMetrics={metricas}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </SafeAreaProvider>,
  );
}
