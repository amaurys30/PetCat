import { LEAFLET_CSS, LEAFLET_JS, LEAFLET_LICENCIA } from "./leaflet.generado";
import type { Coordenada } from "./protocolo";

export type ColoresMapa = {
  fondoPin: string;
  textoPin: string;
  borde: string;
  veterinaria: string;
  peluqueria: string;
  tienda: string;
  otro: string;
  seleccionado: string;
  textoSeleccionado: string;
  ubicacion: string;
};

export type ConfigMapa = {
  /** Plantilla de teselas de Leaflet (EXPO_PUBLIC_MAP_TILES_URL). */
  teselas: string;
  /** Atribución del proveedor de teselas (texto, siempre visible). */
  atribucion: string;
  centro: Coordenada;
  zoom: number;
  colores: ColoresMapa;
};

/**
 * Origen permitido para las imágenes (CSP img-src) a partir de la plantilla de teselas:
 * "https://{s}.tile.openstreetmap.org/{z}/..." -> "https://*.tile.openstreetmap.org".
 * Si las teselas no estuvieran permitidas aquí, el mapa quedaría en blanco.
 */
export function origenTeselas(plantilla: string): string {
  const coincide = /^(https?):\/\/([^/]+)/.exec(plantilla);
  if (!coincide) throw new Error("Plantilla de teselas inválida");
  const [, esquema, host] = coincide;
  return `${esquema}://${host!.replace(/\{s\}\.?/g, "*.")}`;
}

/** JSON dentro de <script>: sin "<" literal, para que nada cierre la etiqueta. */
const jsonEnScript = (valor: unknown) => JSON.stringify(valor).replace(/</g, "\\u003c");

/**
 * Página del mapa. Seguridad: CSP sin red salvo las imágenes de las teselas (sin fetch, sin
 * scripts externos) y la navegación la bloquea la app (navegacion.ts). Accesibilidad: el mapa
 * es solo visual (la app ofrece "Ver lista"); aquí no se lee nada en voz alta.
 */
export function crearHtmlMapa(config: ConfigMapa): string {
  const csp = [
    "default-src 'none'",
    `img-src ${origenTeselas(config.teselas)} data:`,
    "style-src 'unsafe-inline'",
    "script-src 'unsafe-inline'",
  ].join("; ");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<!--
${LEAFLET_LICENCIA.replace(/--/g, "- -")}
-->
<style>${LEAFLET_CSS}</style>
<style>
  html, body, #mapa { margin: 0; padding: 0; height: 100%; width: 100%; background: #e9eef1; }
  .leaflet-control-attribution { font: 12px/1.4 sans-serif; }
  .pin { display: flex; align-items: center; gap: 4px; padding: 4px 10px 4px 4px; border-radius: 999px;
         border: 1px solid var(--borde); background: var(--fondo); color: var(--texto);
         font: 700 14px/1 sans-serif; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,.18);
         transform: translate(-50%, -50%); }
  .pin .icono { width: 26px; height: 26px; border-radius: 999px; display: flex; align-items: center;
                justify-content: center; color: #fff; }
  .pin.sel { background: var(--sel); color: var(--textoSel); border-color: var(--sel); font-size: 16px;
             padding: 6px 14px 6px 6px; }
  .pin.sel .icono { width: 32px; height: 32px; background: #fff !important; }
  .yo { width: 18px; height: 18px; border-radius: 999px; background: var(--ubicacion); border: 3px solid #fff;
        box-shadow: 0 0 0 10px rgba(47,128,237,.18); transform: translate(-50%, -50%); }
</style>
</head>
<body>
<div id="mapa"></div>
<script>${LEAFLET_JS}</script>
<script>
(function () {
  var config = ${jsonEnScript(config)};
  var c = config.colores;
  var raiz = document.documentElement.style;
  raiz.setProperty("--fondo", c.fondoPin); raiz.setProperty("--texto", c.textoPin);
  raiz.setProperty("--borde", c.borde); raiz.setProperty("--sel", c.seleccionado);
  raiz.setProperty("--textoSel", c.textoSeleccionado); raiz.setProperty("--ubicacion", c.ubicacion);

  function enviar(mensaje) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(mensaje));
  }

  var mapa = L.map("mapa", { zoomControl: false, attributionControl: true })
    .setView([config.centro.lat, config.centro.lng], config.zoom);
  mapa.attributionControl.setPrefix(false);

  // Teselas: avisa a la app si no cargan (bloqueadas, sin red), para no dejar el mapa en blanco.
  var cargadas = 0, fallidas = 0, avisado = false;
  var capa = L.tileLayer(config.teselas, { maxZoom: 19, attribution: "" });
  capa.on("tileload", function () {
    cargadas++;
    if (!avisado) { avisado = true; enviar({ tipo: "teselas", estado: "ok" }); }
  });
  capa.on("tileerror", function () {
    fallidas++;
    if (!avisado && cargadas === 0 && fallidas >= 4) { avisado = true; enviar({ tipo: "teselas", estado: "error" }); }
  });
  capa.addTo(mapa);
  // Leaflet inserta la atribución como HTML: va escapada.
  mapa.attributionControl.addAttribution(texto(config.atribucion));

  var ICONOS = {
    veterinaria: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    peluqueria: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/></svg>',
    tienda: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
    otro: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="7" cy="9" r="2.2"/><circle cx="12" cy="6.5" r="2.2"/><circle cx="17" cy="9" r="2.2"/><path d="M12 11c-3 0-5.5 3.2-5.5 5.6 0 1.6 1.4 2.4 2.8 2.4 1 0 1.7-.5 2.7-.5s1.7.5 2.7.5c1.4 0 2.8-.8 2.8-2.4C17.5 14.2 15 11 12 11z"/></svg>'
  };

  function texto(valor) { var d = document.createElement("div"); d.textContent = String(valor); return d.innerHTML; }

  var marcadores = {}, datos = {}, seleccionado = null, yo = null;

  function icono(pin, sel) {
    var color = c[pin.categoria] || c.otro;
    return L.divIcon({
      className: "",
      iconSize: null,
      html: '<div class="pin' + (sel ? " sel" : "") + '"><span class="icono" style="background:' + color + ';color:' +
        (sel ? color : "#fff") + '">' + (ICONOS[pin.categoria] || ICONOS.otro) + "</span>" + texto(pin.etiqueta) + "</div>"
    });
  }

  function pintar(id) {
    var m = marcadores[id];
    if (!m) return;
    var sel = id === seleccionado;
    m.setIcon(icono(datos[id], sel));
    m.setZIndexOffset(sel ? 1000 : 0);
  }

  var recibir = function (m) {
    if (m.tipo === "pines") {
      Object.keys(marcadores).forEach(function (id) { mapa.removeLayer(marcadores[id]); });
      marcadores = {}; datos = {};
      m.pines.forEach(function (p) {
        datos[p.id] = p;
        var marcador = L.marker([p.lat, p.lng], { icon: icono(p, p.id === seleccionado), keyboard: false });
        marcador.on("click", function (e) { L.DomEvent.stopPropagation(e); enviar({ tipo: "pin", id: p.id }); });
        marcador.addTo(mapa);
        marcadores[p.id] = marcador;
      });
      pintar(seleccionado);
    } else if (m.tipo === "seleccionar") {
      var anterior = seleccionado;
      seleccionado = m.id;
      pintar(anterior); pintar(seleccionado);
      if (seleccionado !== null && datos[seleccionado]) mapa.panTo([datos[seleccionado].lat, datos[seleccionado].lng]);
    } else if (m.tipo === "centrar") {
      mapa.setView([m.lat, m.lng], m.zoom || mapa.getZoom());
    } else if (m.tipo === "miUbicacion") {
      var punto = [m.lat, m.lng];
      if (yo) yo.setLatLng(punto);
      else yo = L.marker(punto, { icon: L.divIcon({ className: "", iconSize: null, html: '<div class="yo"></div>' }), interactive: false, keyboard: false }).addTo(mapa);
    }
  };

  mapa.on("click", function () { enviar({ tipo: "fondo" }); });
  mapa.on("moveend", function () {
    var centro = mapa.getCenter();
    enviar({ tipo: "movido", lat: centro.lat, lng: centro.lng, zoom: mapa.getZoom() });
  });

  window.__petcat = { recibir: recibir };
  enviar({ tipo: "listo" });
})();
</script>
</body>
</html>`;
}
