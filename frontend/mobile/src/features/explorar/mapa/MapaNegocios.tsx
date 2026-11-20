import { useEffect, useMemo, useRef, useState, type ComponentType, type Ref } from "react";
import { Linking, View } from "react-native";
import {
  WebView as WebViewOriginal,
  type WebViewMessageEvent,
  type WebViewProps,
} from "react-native-webview";

import { env } from "@/lib/env";
import { colors } from "@/theme/tokens";

import { crearHtmlMapa, type ColoresMapa } from "./html";
import { decidirNavegacion } from "./navegacion";
import { leerMensaje, scriptPara, type Coordenada, type MensajeAlMapa, type Pin } from "./protocolo";

export type { Coordenada, Pin } from "./protocolo";

/** Estado del mapa para la pantalla: si falla, la pantalla muestra la lista. */
export type EstadoMapa = "cargando" | "listo" | "error" | "sin_teselas";

type Props = {
  pines: Pin[];
  seleccionado: number | null;
  /** Centro inicial. Para mover el mapa después, `centrar` con una clave nueva. */
  centro: Coordenada;
  centrar?: (Coordenada & { clave: number }) | null;
  miUbicacion?: Coordenada | null;
  onSeleccionar: (id: number | null) => void;
  onEstado: (estado: EstadoMapa) => void;
  /** Texto para el lector (el mapa es solo visual: la pantalla ofrece "Ver lista"). */
  descripcion: string;
};

// react-native-webview 14.0.1 tipa la clase como WebView<P = undefined> con props `WebViewProps & P`:
// con P = undefined la intersección es never y ninguna prop pasa el typecheck. Mismo componente, bien tipado.
type ManejadorWebView = { injectJavaScript: (script: string) => void };
const WebView = WebViewOriginal as unknown as ComponentType<WebViewProps & { ref?: Ref<ManejadorWebView> }>;

const ZOOM_INICIAL = 14;
const ESPERA_LISTO_MS = 10_000;

const COLORES: ColoresMapa = {
  fondoPin: colors.white,
  textoPin: colors.ink,
  borde: colors.border,
  veterinaria: colors["primary-strong"],
  peluqueria: colors["coral-dark"],
  tienda: colors["lavender-ink"],
  otro: colors.muted,
  seleccionado: colors.coral,
  textoSeleccionado: colors["coral-ink"],
  ubicacion: colors.info,
};

/**
 * Mapa de negocios: Leaflet + OpenStreetMap dentro de react-native-webview (funciona en Expo Go).
 * Es el único lugar que conoce el WebView y el protocolo de mensajes: para pasar a MapLibre se
 * reemplaza este módulo con las mismas props.
 */
export function MapaNegocios({
  pines,
  seleccionado,
  centro,
  centrar,
  miUbicacion,
  onSeleccionar,
  onEstado,
  descripcion,
}: Props) {
  const web = useRef<ManejadorWebView>(null);
  const [listo, setListo] = useState(false);
  // El HTML se arma una vez: los cambios van por mensajes (sin recargar el WebView).
  const [html] = useState(() =>
    crearHtmlMapa({
      teselas: env.mapa.teselas,
      atribucion: env.mapa.atribucion,
      centro,
      zoom: ZOOM_INICIAL,
      colores: COLORES,
    }),
  );

  const enviar = (mensaje: MensajeAlMapa) => web.current?.injectJavaScript(scriptPara(mensaje));

  // Sin "listo" a tiempo, el mapa no cargó: la pantalla pasa a la lista.
  useEffect(() => {
    if (listo) return;
    const espera = setTimeout(() => onEstado("error"), ESPERA_LISTO_MS);
    return () => clearTimeout(espera);
  }, [listo, onEstado]);

  // Solo cuando cambian (y cuando el mapa está listo, para no perderlos).
  const clavePines = useMemo(() => JSON.stringify(pines), [pines]);
  useEffect(() => {
    if (listo) enviar({ tipo: "pines", pines });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clavePines resume los pines
  }, [listo, clavePines]);
  useEffect(() => {
    if (listo) enviar({ tipo: "seleccionar", id: seleccionado });
  }, [listo, seleccionado]);
  useEffect(() => {
    if (listo && miUbicacion) enviar({ tipo: "miUbicacion", ...miUbicacion });
  }, [listo, miUbicacion]);
  useEffect(() => {
    if (listo && centrar) enviar({ tipo: "centrar", lat: centrar.lat, lng: centrar.lng });
  }, [listo, centrar]);

  const alRecibir = (evento: WebViewMessageEvent) => {
    const mensaje = leerMensaje(evento.nativeEvent.data);
    if (!mensaje) return;
    if (mensaje.tipo === "listo") {
      setListo(true);
      onEstado("listo");
    } else if (mensaje.tipo === "pin") {
      onSeleccionar(mensaje.id);
    } else if (mensaje.tipo === "fondo") {
      onSeleccionar(null);
    } else if (mensaje.tipo === "teselas" && mensaje.estado === "error") {
      onEstado("sin_teselas");
    }
  };

  return (
    <View
      className="flex-1"
      accessible
      accessibilityLabel={descripcion}
      // El contenido del WebView no se recorre con el lector: la alternativa es "Ver lista".
      importantForAccessibility="yes"
      testID="mapa-negocios"
    >
      <View className="flex-1" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <WebView
          ref={web}
          source={{ html }}
          originWhitelist={["about:blank", "data:*"]}
          onShouldStartLoadWithRequest={(pedido) => {
            const { cargar, abrirFuera } = decidirNavegacion(pedido.url);
            if (abrirFuera) void Linking.openURL(abrirFuera);
            return cargar;
          }}
          onMessage={alRecibir}
          onError={() => onEstado("error")}
          onHttpError={() => onEstado("error")}
          onContentProcessDidTerminate={() => onEstado("error")}
          onRenderProcessGone={() => onEstado("error")}
          javaScriptEnabled
          domStorageEnabled={false}
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          setSupportMultipleWindows={false}
          geolocationEnabled={false}
          cacheEnabled
          style={{ flex: 1, backgroundColor: colors.track }}
          testID="mapa-webview"
        />
      </View>
    </View>
  );
}
