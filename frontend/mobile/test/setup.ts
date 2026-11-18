import { server } from "./msw/server";

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
