import * as WebBrowser from "expo-web-browser";
import { ScrollView, View } from "react-native";

import { Aviso, Button, ScreenHeader, Text } from "@/components/ui";
import { RESPALDO } from "@/lib/navegacion";

import { usePoliticaDatos } from "./politica";

// Resumen de la política mientras `politica_datos_url` esté vacía. PROVISIONAL: lo reemplaza la
// página pública con el texto revisado (PLAN.md, "Antes de publicar en tiendas").
const SECCIONES = [
  {
    titulo: "Quién trata tus datos",
    texto: "PetCat, la plataforma de servicios para mascotas de Sincelejo.",
  },
  {
    titulo: "Qué datos",
    texto:
      "Tu nombre, apellido, correo y teléfono (si lo das); los datos de tus mascotas; tus citas; y el carnet de vacunas y el historial de salud que registran las veterinarias que visitas.",
  },
  {
    titulo: "Para qué",
    texto:
      "Crear tu cuenta, agendar tus citas y recordártelas, llevar el carnet y el historial de tus mascotas, avisarte por correo o notificaciones y mejorar el servicio.",
  },
  {
    titulo: "Con quién se comparten",
    texto: "Solo con los negocios donde agendas una cita, para atenderte. No vendemos tus datos.",
  },
  {
    titulo: "Tus derechos (Ley 1581 de 2012)",
    texto:
      "Conocer, actualizar y rectificar tus datos, pedir que los suprimamos y revocar esta autorización, escribiendo al contacto de soporte de PetCat.",
  },
];

export function PoliticaScreen() {
  const politica = usePoliticaDatos();
  const url = politica.data?.url;

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader titulo="Política de datos" volverA={RESPALDO.inicio} />
      <ScrollView contentContainerClassName="gap-5 px-pantalla pb-10">
        {url ? (
          <Button titulo="Leer la política completa" onPress={() => WebBrowser.openBrowserAsync(url)} />
        ) : (
          <Aviso tono="info">
            {`Versión provisional${politica.data ? ` ${politica.data.version}` : ""}. Este es un resumen: la política completa se publicará antes del lanzamiento de la app.`}
          </Aviso>
        )}
        {SECCIONES.map((s) => (
          <View key={s.titulo} className="gap-1">
            <Text variante="seccion">{s.titulo}</Text>
            <Text>{s.texto}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
