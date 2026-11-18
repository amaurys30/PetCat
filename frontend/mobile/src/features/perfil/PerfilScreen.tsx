import { useRouter } from "expo-router";
import { LogOut, ShieldCheck, Wifi } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { Avatar, Aviso, Button, Card, Enlace, ScreenHeader, Text } from "@/components/ui";
import { useSesion } from "@/store/sesion";

import { useAbrirPolitica } from "../auth/politica";
import { cerrarSesion } from "../sesion/acciones";

// Perfil mínimo de M1 (datos, confirmar el correo, política y cerrar sesión). M19 lo completa.
export function PerfilScreen() {
  const router = useRouter();
  const usuario = useSesion((s) => s.usuario);
  const abrirPolitica = useAbrirPolitica();
  const [cerrando, setCerrando] = useState(false);

  const nombre = usuario ? `${usuario.nombre} ${usuario.apellido}` : "";

  const salir = async () => {
    setCerrando(true);
    // Borra tokens y caché; las rutas protegidas llevan a la bienvenida.
    await cerrarSesion();
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader titulo="Perfil" />
      <ScrollView contentContainerClassName="gap-4 px-pantalla pb-8">
        {usuario && (
          <Card className="flex-row items-center gap-4">
            <Avatar nombre={nombre} uri={usuario.foto_miniatura_url} />
            <View className="flex-1 gap-0.5">
              <Text variante="seccion">{nombre}</Text>
              <Text variante="apoyo" className="text-muted">
                {usuario.email}
              </Text>
            </View>
          </Card>
        )}

        {usuario && !usuario.email_verificado && (
          <Aviso
            tono="consejo"
            accion={
              <Enlace
                titulo="Confirmar ahora"
                onPress={() => router.push("/verificar-correo")}
                className="self-start"
              />
            }
          >
            Tu correo aún no está confirmado. Confírmalo para recuperar tu cuenta si olvidas la contraseña.
          </Aviso>
        )}

        <Button titulo="Política de datos" variante="suave" icono={ShieldCheck} onPress={abrirPolitica} />
        {__DEV__ && (
          <Button
            titulo="Diagnóstico de la conexión"
            variante="suave"
            icono={Wifi}
            onPress={() => router.push("/dev/estado")}
          />
        )}
        <Button
          titulo="Cerrar sesión"
          variante="secundario"
          icono={LogOut}
          cargando={cerrando}
          onPress={salir}
        />
      </ScrollView>
    </View>
  );
}
