import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Flujos de punta a punta contra la API real con la base de demo:
 *   docker compose --profile panel up -d backend-demo     (API de demo en 127.0.0.1:3001)
 *   cd frontend/web; npm run test:e2e
 * Si la API de demo está en otra dirección: $env:VITE_API_PROXY_TARGET="http://localhost:3000"
 *
 * Las pruebas construyen el panel (en una carpeta temporal del sistema, fuera del repositorio y de
 * OneDrive) y lo sirven con vite preview en el puerto 5180,
 * con el mismo proxy a la API: no usan el Vite que tengas abierto en el 5173 y no compilan
 * módulos sobre la marcha (con un Vite de desarrollo en frío, el proxy demoraba las respuestas
 * de la API varios segundos mientras transformaba las rutas). Se construye sin clave de
 * Google Maps: la ubicación de las sedes usa coordenadas manuales, haya o no
 * VITE_GOOGLE_MAPS_API_KEY en .env.local. Los correos se leen de Mailpit.
 */
const PUERTO = 5180;
/** Build de las pruebas y resultados (trazas, capturas): fuera del repositorio, que está en OneDrive. */
const TEMPORAL = join(tmpdir(), "petcat-e2e");
const BUILD = join(TEMPORAL, "dist");

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: join(TEMPORAL, "test-results"),
  fullyParallel: false,
  // Una prueba a la vez: comparten la API de demo y sus cuentas, y con dos procesos (varios
  // navegadores cada uno, más la traza) el equipo llegaba al 100 % de CPU al arrancar, la API
  // en Docker respondía en segundos y fallaban pruebas al azar.
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PUERTO}`,
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
    command: `npx vite build --outDir "${BUILD}" --emptyOutDir && npx vite preview --outDir "${BUILD}" --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: false,
    timeout: 120_000,
    // Las variables del proceso tienen prioridad sobre .env.local en Vite (también en el build).
    env: { VITE_GOOGLE_MAPS_API_KEY: "", VITE_GOOGLE_MAPS_MAP_ID: "" },
  },
});
