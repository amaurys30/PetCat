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
import MascotasLayout from "../app/mascotas/_layout";
import MisMascotas from "../app/mascotas/index";
import NuevaMascota from "../app/mascotas/nueva";
import FichaMascota from "../app/mascotas/[id]/index";
import EditarMascota from "../app/mascotas/[id]/editar";
import Fallecimiento from "../app/mascotas/[id]/fallecimiento";
import LineaDeVida from "../app/mascotas/[id]/linea-vida";
import Sensor from "../app/dev/sensor";
import NegociosLayout from "../app/negocios/_layout";
import PerfilNegocio from "../app/negocios/[id]/index";
import AgendarCita from "../app/negocios/[id]/agendar";
import CitaLayout from "../app/cita/_layout";
import DetalleCita from "../app/cita/[id]/index";
import CitaConfirmada from "../app/cita/[id]/confirmada";
import ReprogramarCita from "../app/cita/[id]/reprogramar";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { refreshStorage } from "@/api/refreshStorage";
import { queryClient } from "@/lib/queryClient";
import { useMascotaSeleccionada } from "@/store/mascotaSeleccionada";
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
  "mascotas/_layout": MascotasLayout,
  "mascotas/index": MisMascotas,
  "mascotas/nueva": NuevaMascota,
  "mascotas/[id]/index": FichaMascota,
  "mascotas/[id]/editar": EditarMascota,
  "mascotas/[id]/fallecimiento": Fallecimiento,
  "mascotas/[id]/linea-vida": LineaDeVida,
  "dev/sensor": Sensor,
  "negocios/_layout": NegociosLayout,
  "negocios/[id]/index": PerfilNegocio,
  "negocios/[id]/agendar": AgendarCita,
  "cita/_layout": CitaLayout,
  "cita/[id]/index": DetalleCita,
  "cita/[id]/confirmada": CitaConfirmada,
  "cita/[id]/reprogramar": ReprogramarCita,
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
    modoSinConexion: false,
    sinConexion: null,
  });
  useMascotaSeleccionada.setState({ id_usuario: null, id_mascota: null });
  await AsyncStorage.clear();
  queryClient.clear();
}

/** Abre la app como al tocar su ícono (o en una ruta), con el arranque real. */
export function renderApp(initialUrl = "/") {
  return renderRouter(RUTAS, { initialUrl });
}
