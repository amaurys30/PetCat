import { Image } from "expo-image";
import { Camera, ImagePlus, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { AccessibilityInfo, Linking, Modal, View } from "react-native";

import { Aviso, Avatar, Button, Text } from "@/components/ui";
import { elegirDeGaleria, tomarFoto, type ResultadoFoto } from "@/lib/fotos";

type Props = {
  nombre: string;
  especie?: string;
  /** Foto elegida (URI local, ya comprimida) o la que ya tiene en la API. */
  uri: string | null;
  onElegir: (uri: string) => void;
  onQuitar?: () => void;
  deshabilitado?: boolean;
};

/**
 * Foto de la mascota. Antes del permiso de la cámara, una hoja explica para qué se usa; si lo
 * niega del todo, explica cómo activarlo en Ajustes. La galería no pide permiso.
 */
export function FotoMascota({ nombre, especie, uri, onElegir, onQuitar, deshabilitado }: Props) {
  const [explicando, setExplicando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; ajustes?: boolean } | null>(null);
  const [procesando, setProcesando] = useState(false);

  const usar = async (obtener: () => Promise<ResultadoFoto>) => {
    setAviso(null);
    setProcesando(true);
    try {
      const resultado = await obtener();
      if (resultado.estado === "lista") {
        onElegir(resultado.uri);
        AccessibilityInfo.announceForAccessibility("Foto lista");
      } else if (resultado.estado === "sin_permiso") {
        setAviso(
          resultado.puedePedirOtraVez
            ? { texto: "Sin permiso para usar la cámara. Puedes elegir una foto de la galería." }
            : {
                texto:
                  "La cámara está desactivada para PetCat. Puedes activarla en Ajustes o elegir una foto de la galería.",
                ajustes: true,
              },
        );
      }
    } catch {
      setAviso({ texto: "No pudimos preparar la foto. Intenta con otra." });
    } finally {
      setProcesando(false);
    }
  };

  return (
    <View className="items-center gap-3">
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: 120, height: 120, borderRadius: 28 }}
          contentFit="cover"
          accessible
          accessibilityLabel={`Foto de ${nombre || "la mascota"}`}
        />
      ) : (
        <Avatar nombre={nombre || "Mascota"} especie={especie ?? "otro"} tamano="lg" />
      )}
      <View className="w-full flex-row flex-wrap justify-center gap-2">
        <Button
          titulo="Tomar foto"
          variante="suave"
          icono={Camera}
          disabled={deshabilitado || procesando}
          onPress={() => setExplicando(true)}
        />
        <Button
          titulo={uri ? "Cambiar de la galería" : "Elegir de la galería"}
          variante="suave"
          icono={ImagePlus}
          disabled={deshabilitado || procesando}
          onPress={() => usar(elegirDeGaleria)}
        />
        {uri && onQuitar && (
          <Button
            titulo="Quitar foto"
            variante="secundario"
            icono={Trash2}
            disabled={deshabilitado}
            onPress={onQuitar}
          />
        )}
      </View>
      {aviso && (
        <Aviso
          tono="error"
          accion={
            aviso.ajustes ? (
              <Button titulo="Abrir Ajustes" variante="secundario" onPress={() => Linking.openSettings()} />
            ) : undefined
          }
        >
          {aviso.texto}
        </Aviso>
      )}

      <Modal
        visible={explicando}
        transparent
        animationType="fade"
        onRequestClose={() => setExplicando(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="gap-4 rounded-t-[28px] bg-white px-pantalla pb-10 pt-6" accessibilityViewIsModal>
            <Text variante="seccion">Usar la cámara</Text>
            <Text>
              PetCat usará la cámara solo para tomar la foto de tu mascota, y solo cuando tú lo elijas. A
              continuación tu teléfono te pedirá el permiso.
            </Text>
            <Button
              titulo="Usar la cámara"
              onPress={() => {
                setExplicando(false);
                usar(tomarFoto);
              }}
            />
            <Button titulo="Ahora no" variante="secundario" onPress={() => setExplicando(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
