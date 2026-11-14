import type { BrowserContext } from "@playwright/test";

/**
 * Mosaicos del mapa en las pruebas. El build de punta a punta apunta `VITE_MAP_TILES_URL` a
 * este dominio inventado (ver playwright.config.ts) y cada contexto lo responde con un PNG
 * vacío: las pruebas no le piden mosaicos a OpenStreetMap, cuya política de uso lo prohíbe
 * para tráfico automatizado. Sin la ruta, los mosaicos fallan y la sede pasa a coordenadas.
 */
export const MOSAICOS_E2E = "https://mosaicos.e2e.test/{z}/{x}/{y}.png";

const PNG_VACIO = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

export async function mosaicosFalsos(context: BrowserContext) {
  await context.route("https://mosaicos.e2e.test/**", (ruta) =>
    ruta.fulfill({ contentType: "image/png", body: PNG_VACIO }),
  );
}
