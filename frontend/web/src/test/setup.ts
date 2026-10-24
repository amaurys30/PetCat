import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { toast } from "sonner";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { useUi } from "@/stores/ui";
import { servidor } from "./servidor";
import { sockets } from "./socketFalso";

// Sin servidor de Socket.IO: las pruebas manejan la conexión con socketFalso().
vi.mock("socket.io-client", () => import("./socketFalso"));

// findBy* y waitFor esperan 1 s por defecto: con todos los archivos en paralelo, la primera
// carga de la app (router completo y consultas a la API simulada) a veces tardaba más.
configure({ asyncUtilTimeout: 5_000 });

// jsdom no trae ResizeObserver y algunos componentes de Radix lo usan (Checkbox, Tooltip).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// El Select de Radix usa la captura del puntero y scrollIntoView, que jsdom no trae.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => undefined;
Element.prototype.setPointerCapture ??= () => undefined;
Element.prototype.scrollIntoView ??= () => undefined;

beforeAll(() => servidor.listen({ onUnhandledFrame: "error" }));
afterEach(async () => {
  cleanup();
  // Los avisos de sonner viven fuera de React: sin esto pasan a la prueba siguiente.
  toast.dismiss();
  // Importado aquí y no arriba: así una prueba puede simular lo que lib/socket usa.
  (await import("@/lib/socket")).cerrarSocket();
  sockets.length = 0;
  servidor.resetHandlers();
  localStorage.clear();
  sessionStorage.clear();
  useUi.setState({
    limitePlan: null,
    citasAfectadas: null,
    accionCita: null,
    registroMedico: null,
    vacuna: null,
  });
});
afterAll(() => servidor.close());
