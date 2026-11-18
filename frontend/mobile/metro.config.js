const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const raiz = __dirname;
const config = getDefaultConfig(raiz);

// frontend/mobile es un proyecto npm independiente (no hay workspace en frontend/ ni en la raíz).
// Metro solo mira esta carpeta: nunca resuelve paquetes de frontend/node_modules ni de
// frontend/web, aunque alguien instale algo ahí.
const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const carpetaWeb = path.resolve(raiz, "..", "web");

config.watchFolders = [raiz];
config.resolver.nodeModulesPaths = [path.resolve(raiz, "node_modules")];
// disableHierarchicalLookup no se activa: también apaga los node_modules anidados de cada
// paquete, y Reanimated necesita el suyo (semver). El blockList cubre frontend/web; la búsqueda
// hacia arriba solo llegaría a frontend/node_modules (si existe, vacío e ignorado por git).
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  new RegExp(`^${escapar(carpetaWeb)}[\\\\/].*`),
];

module.exports = withNativeWind(config, { input: "./global.css" });
