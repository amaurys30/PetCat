// Las pruebas corren con el teléfono "en Tokio": si una fecha dependiera de la zona del equipo
// en lugar de America/Bogota, fallaría aquí. Se fija antes de crear los workers.
process.env.TZ = "Asia/Tokyo";
// URL de la API en las pruebas (MSW la intercepta; nunca se llama al backend real).
process.env.EXPO_PUBLIC_API_URL = "http://api.test/api/v1";

const ESM = [
  "(jest-)?react-native",
  "@react-native(-community)?",
  "expo(nent)?",
  "@expo(nent)?/.*",
  "@expo-google-fonts/.*",
  "react-navigation",
  "@react-navigation/.*",
  "nativewind",
  "react-native-css-interop",
  "react-native-svg",
  "standard-navigation",
  // MSW 3 y sus dependencias solo publican ESM.
  "msw",
  "@msw/.*",
  "@mswjs/.*",
  "@open-draft/.*",
  "until-async",
  "rettime",
  "outvariant",
  "strict-event-emitter",
  "headers-polyfill",
  "is-node-process",
  "tough-cookie",
  "tldts",
  "tldts-core",
  "cookie",
  "statuses",
  "path-to-regexp",
  "graphql",
  "type-fest",
  "picocolors",
];

/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  // Entorno de jest-expo que conserva el fetch de Node para MSW (ver test/environment.js).
  testEnvironment: "<rootDir>/test/environment.js",
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  // renderRouter (expo-router/testing-library) activa los timers falsos con jest.useFakeTimers(),
  // que toma estas opciones. nextTick y setImmediate siguen reales: el fetch de Node (y MSW)
  // los usa para resolver las peticiones; con ellos falsos, cualquier pantalla que llame a la
  // API se queda esperando.
  fakeTimers: { doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] },
  testMatch: ["<rootDir>/src/**/*.test.{ts,tsx}"],
  transform: { "\\.mjs$": "babel-jest" },
  transformIgnorePatterns: [`node_modules/(?!(${ESM.join("|")}))`],
  moduleNameMapper: {
    // global.css lo compila Metro con NativeWind; en Jest no hace falta.
    "\\.css$": "<rootDir>/test/vacio.js",
    "^lucide-react-native$": "<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js",
    // Reanimated: mock propio. expo-router/testing-library registra el suyo con react-native-reanimated/mock,
    // que carga la librería real y falla sin el runtime nativo: las dos rutas apuntan al propio
    // (en archivos distintos, ver test/reanimated.ts).
    "^react-native-reanimated$": "<rootDir>/test/reanimated.ts",
    "^react-native-reanimated/mock$": "<rootDir>/test/reanimatedMock.tsx",
  },
};
