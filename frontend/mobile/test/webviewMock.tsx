import { forwardRef, useImperativeHandle } from "react";
import { View, type ViewProps } from "react-native";

// react-native-webview en Jest: un View que conserva sus props (las pruebas simulan los mensajes
// del mapa con fireEvent(webview, "message", ...)) y guarda lo que la app inyecta.
export const inyectados: string[] = [];

export const WebView = forwardRef<{ injectJavaScript: (codigo: string) => void }, ViewProps>(
  function WebView(props, ref) {
    useImperativeHandle(ref, () => ({ injectJavaScript: (codigo: string) => void inyectados.push(codigo) }));
    return <View {...props} />;
  },
);

export default WebView;
