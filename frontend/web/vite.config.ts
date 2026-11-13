/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // A dónde reenvía el proxy de desarrollo: por defecto la API de demo en Docker (backend-demo, petcat_demo).
  const apiTarget = env.VITE_API_PROXY_TARGET || "http://localhost:3001";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
        "/socket.io": { target: apiTarget, changeOrigin: true, ws: true },
      },
    },
    test: {
      environment: "jsdom",
      environmentOptions: { jsdom: { url: "http://localhost/" } },
      globals: false,
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      css: false,
      // Las pruebas de pantalla pintan el router completo y hacen varios clics: con todos los
      // archivos en paralelo, algunas pasaban de los 5 s por defecto en equipos cargados.
      testTimeout: 15_000,
      // Con un worker por núcleo (11 en un equipo de 12) las pantallas pesadas (dashboard, ficha,
      // asistente) vencían sus findBy de 5 s por la carga y fallaban pruebas distintas en cada
      // corrida. Con la mitad pasan todas y la suite termina antes (161 s contra 190 s).
      maxWorkers: "50%",
    },
  };
});
