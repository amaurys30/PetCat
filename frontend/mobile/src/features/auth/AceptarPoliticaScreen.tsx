import { useState } from "react";
import { AccessibilityInfo, View } from "react-native";

import { postAceptarPolitica } from "@/api/auth";
import { toApiError } from "@/api/errors";
import { Aviso, Button, Checkbox, Enlace, PantallaFormulario, Text } from "@/components/ui";
import { useSesion } from "@/store/sesion";

import { cerrarSesion } from "../sesion/acciones";
import { useAbrirPolitica, usePoliticaDatos } from "./politica";

// Cuenta sin autorización para la versión vigente de la política (Ley 1581): antes de seguir, la
// acepta (POST /auth/politica-datos/aceptar) o cierra sesión.
export function AceptarPoliticaScreen() {
  const politica = usePoliticaDatos();
  const abrirPolitica = useAbrirPolitica();
  const [acepta, setAcepta] = useState(false);
  const [errorCasilla, setErrorCasilla] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const aceptar = async () => {
    setError(null);
    if (!acepta) {
      const mensaje = "Marca la casilla para aceptar la política";
      setErrorCasilla(mensaje);
      AccessibilityInfo.announceForAccessibility(mensaje);
      return;
    }
    setEnviando(true);
    try {
      await postAceptarPolitica();
      // Con la política aceptada, las rutas protegidas llevan a las pestañas.
      useSesion.getState().setRequierePolitica(false);
    } catch (e) {
      const mensaje = toApiError(e).message;
      setError(mensaje);
      AccessibilityInfo.announceForAccessibility(mensaje);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <PantallaFormulario>
      <View className="gap-2">
        <Text variante="titulo">Actualizamos nuestra política de datos</Text>
        <Text className="text-muted">
          Para seguir usando PetCat necesitamos tu autorización para tratar tus datos con la versión vigente
          de la política{politica.data ? ` (${politica.data.version})` : ""}.
        </Text>
      </View>
      <Enlace titulo="Ver política" onPress={abrirPolitica} className="self-start" />
      <Checkbox
        etiqueta="Acepto la política de tratamiento de datos personales (Ley 1581 de 2012)."
        marcado={acepta}
        onCambiar={(v) => {
          setAcepta(v);
          setErrorCasilla(undefined);
        }}
        error={errorCasilla}
      />
      {error && <Aviso tono="error">{error}</Aviso>}
      <Button titulo="Aceptar y continuar" cargando={enviando} onPress={aceptar} />
      <Enlace rol="button" titulo="Cerrar sesión" onPress={() => cerrarSesion()} className="self-center" />
    </PantallaFormulario>
  );
}
