/**
 * Genera src/features/explorar/mapa/leaflet.generado.ts con Leaflet (JS y CSS) como texto, para
 * el mapa de Explorar dentro de react-native-webview: así no depende de un CDN.
 *
 *   npm run mapa:leaflet
 *
 * Leaflet se instala como devDependency con la misma versión que el panel web. Al subir de
 * versión, volver a generar y subir el archivo. Incluye el aviso de licencia (BSD-2).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const raiz = dirname(require.resolve("leaflet/package.json"));
const { version } = JSON.parse(readFileSync(join(raiz, "package.json"), "utf8"));
const licencia = readFileSync(join(raiz, "LICENSE"), "utf8").trim();
const js = readFileSync(join(raiz, "dist", "leaflet.js"), "utf8");
const css = readFileSync(join(raiz, "dist", "leaflet.css"), "utf8");

const comentario = licencia
  .split(/\r?\n/)
  .map((linea) => ` * ${linea}`.trimEnd())
  .join("\n");

const salida = `/* eslint-disable */
// prettier-ignore
/**
 * ARCHIVO GENERADO por scripts/generar-leaflet.mjs (npm run mapa:leaflet): no editar a mano.
 * Leaflet ${version} (https://leafletjs.com), distribuido con la app dentro del mapa de Explorar.
 *
${comentario}
 */

export const LEAFLET_VERSION = ${JSON.stringify(version)};

/** Aviso de licencia de Leaflet (BSD-2), también incluido en el HTML del mapa. */
export const LEAFLET_LICENCIA = ${JSON.stringify(licencia)};

export const LEAFLET_JS = ${JSON.stringify(js)};

export const LEAFLET_CSS = ${JSON.stringify(css)};
`;

const destino = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "features",
  "explorar",
  "mapa",
  "leaflet.generado.ts",
);
writeFileSync(destino, salida);
console.log(`Leaflet ${version} -> ${destino} (${Math.round(salida.length / 1024)} KB)`);
