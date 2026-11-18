import { configure } from "@testing-library/react-native";

import { server } from "./msw/server";

// Las pruebas de flujo (arranque, rutas protegidas, varias pantallas) pasan del segundo por
// defecto de findBy*/waitFor cuando el equipo o CI están cargados.
configure({ asyncUtilTimeout: 5_000 });

// fetch, Request, Response y Headers de Node (ver test/environment.js): MSW los intercepta.
const webDeNode = (globalThis as unknown as { __webDeNode: Record<string, unknown> }).__webDeNode;
for (const [nombre, valor] of Object.entries(webDeNode)) {
  Object.defineProperty(globalThis, nombre, { value: valor, writable: true, configurable: true });
}

// Mismo aviso que se calla en app/_layout.tsx: lo dispara NativeWind, no la app.
const warnOriginal = console.warn;
console.warn = (...args: unknown[]) => {
  if (String(args[0]).startsWith("ImageBackground is deprecated")) return;
  warnOriginal(...args);
};

// NetInfo: el mock de la librería (addEventListener es un jest.fn; las pruebas llaman al listener).
jest.mock("@react-native-community/netinfo", () =>
  require("@react-native-community/netinfo/jest/netinfo-mock.js"),
);

// SecureStore en memoria (el módulo nativo no existe en Jest).
jest.mock("expo-secure-store", () => {
  const datos = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (clave: string) => datos.get(clave) ?? null),
    setItemAsync: jest.fn(async (clave: string, valor: string) => {
      datos.set(clave, valor);
    }),
    deleteItemAsync: jest.fn(async (clave: string) => {
      datos.delete(clave);
    }),
  };
});

// Antes de importar los módulos de la prueba: axios toma el fetch global al cargarse.
// MSW 3: onUnhandledFrame (antes onUnhandledRequest). Una petición sin handler hace fallar la prueba.
server.listen({ onUnhandledFrame: "error" });
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
