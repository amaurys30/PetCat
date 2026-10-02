/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // A dónde reenvía el proxy de desarrollo. Por defecto la API de backend/ (npm run dev o dev:demo).
  const apiTarget = env.VITE_API_PROXY || "http://localhost:3000";

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
    },
  };
});
