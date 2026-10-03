import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { useUi } from "@/stores/ui";
import { servidor } from "./servidor";

// jsdom no trae ResizeObserver y algunos componentes de Radix lo usan (Checkbox, Tooltip).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

beforeAll(() => servidor.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  cleanup();
  servidor.resetHandlers();
  localStorage.clear();
  sessionStorage.clear();
  useUi.setState({ limitePlan: null, citasAfectadas: null });
});
afterAll(() => servidor.close());
