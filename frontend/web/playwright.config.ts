import { defineConfig, devices } from "@playwright/test";

/**
 * Flujos de punta a punta contra la API real con la base de demo:
 *   docker compose --profile panel up -d backend-demo     (API de demo en 127.0.0.1:3001)
 *   cd frontend/web; npm run test:e2e
 * Si la API de demo está en otra dirección: $env:VITE_API_PROXY_TARGET="http://localhost:3000"
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    locale: "es-CO",
    timezoneId: "America/Bogota",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        // Por defecto, el Chrome instalado en el equipo (sin descargar navegadores).
        // Con `npx playwright install chromium` se puede usar el de Playwright: E2E_CHANNEL=chromium.
        channel: process.env.E2E_CHANNEL || "chrome",
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
