import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { useUi } from "@/stores/ui";
import { servidor } from "./servidor";

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
Element.prototype.scrollIntoView ??= () => undefined;

beforeAll(() => servidor.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  cleanup();
  servidor.resetHandlers();
  localStorage.clear();
  sessionStorage.clear();
  useUi.setState({ limitePlan: null, citasAfectadas: null, accionCita: null });
});
afterAll(() => servidor.close());
