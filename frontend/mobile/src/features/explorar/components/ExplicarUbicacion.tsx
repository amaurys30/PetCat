import { MapPin } from "lucide-react-native";
import { Modal, View } from "react-native";

import { Button, Text } from "@/components/ui";
import { colors } from "@/theme/tokens";

type Props = { visible: boolean; onUsar: () => void; onAhoraNo: () => void };

/**
 * Antes de pedir el permiso de ubicación: para qué se usa. Si dice "Ahora no", el mapa centra en
 * Sincelejo (sin distancias). El gesto atrás también cierra la hoja.
 */
export function ExplicarUbicacion({ visible, onUsar, onAhoraNo }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onAhoraNo}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="gap-4 rounded-t-[28px] bg-white px-pantalla pb-10 pt-6" accessibilityViewIsModal>
          <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
            <MapPin size={24} color={colors["primary-deep"]} />
          </View>
          <Text variante="seccion" accessibilityRole="header">
            Ver lo que está cerca
          </Text>
          <Text>
            PetCat usa tu ubicación para mostrarte las veterinarias, peluquerías y tiendas más cercanas y a
            qué distancia están. Solo mientras usas la app; no la guardamos. A continuación tu teléfono te
            pedirá el permiso.
          </Text>
          <Button titulo="Usar mi ubicación" onPress={onUsar} />
          <Button titulo="Ahora no" variante="secundario" onPress={onAhoraNo} />
        </View>
      </View>
    </Modal>
  );
}
