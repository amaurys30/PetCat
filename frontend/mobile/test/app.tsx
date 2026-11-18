import { renderRouter } from "expo-router/testing-library";

import AuthLayout from "../app/(auth)/_layout";
import Bienvenida from "../app/(auth)/bienvenida";
import Login from "../app/(auth)/login";
import Recuperar from "../app/(auth)/recuperar";
import RecuperarCodigo from "../app/(auth)/recuperar-codigo";
import Registro from "../app/(auth)/registro";
import TabsLayout from "../app/(tabs)/_layout";
import Carnet from "../app/(tabs)/carnet";
import Citas from "../app/(tabs)/citas";
import Explorar from "../app/(tabs)/explorar";
import Inicio from "../app/(tabs)/index";
import Perfil from "../app/(tabs)/perfil";
import RootLayout from "../app/_layout";
import AceptarPolitica from "../app/aceptar-politica";
import Estado from "../app/dev/estado";
import Politica from "../app/politica";
import VerificarCorreo from "../app/verificar-correo";

import { refreshStorage } from "@/api/refreshStorage";
import { queryClient } from "@/lib/queryClient";
import { useSesion } from "@/store/sesion";

/** Todas las rutas reales de la app, con su layout raíz (arranque y rutas protegidas). */
export const RUTAS = {
  _layout: RootLayout,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/index": Inicio,
  "(tabs)/explorar": Explorar,
  "(tabs)/carnet": Carnet,
  "(tabs)/citas": Citas,
  "(tabs)/perfil": Perfil,
  "(auth)/_layout": AuthLayout,
  "(auth)/bienvenida": Bienvenida,
  "(auth)/registro": Registro,
  "(auth)/login": Login,
  "(auth)/recuperar": Recuperar,
  "(auth)/recuperar-codigo": RecuperarCodigo,
  "verificar-correo": VerificarCorreo,
  "aceptar-politica": AceptarPolitica,
  politica: Politica,
  "dev/estado": Estado,
};

/** Estado limpio entre pruebas: sin sesión en memoria, sin refresh guardado y sin caché. */
export async function reiniciarSesion() {
  await refreshStorage.borrar();
  useSesion.setState({
    accessToken: null,
    usuario: null,
    estado: "desconocida",
    requierePolitica: false,
    recienRegistrado: false,
  });
  queryClient.clear();
}

/** Abre la app como al tocar su ícono (o en una ruta), con el arranque real. */
export function renderApp(initialUrl = "/") {
  return renderRouter(RUTAS, { initialUrl });
}
