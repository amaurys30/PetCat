import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";

import { EmptyState, ScreenHeader } from "@/components/ui";

type Props = { titulo: string; icono: LucideIcon; mensaje: string; fase: string };

// Pestaña de M0: solo el título y qué llegará, con la fase del plan.
export function PestanaVacia({ titulo, icono, mensaje, fase }: Props) {
  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader titulo={titulo} />
      <EmptyState icono={icono} titulo="Muy pronto" descripcion={`${mensaje} Llega en la fase ${fase}.`} />
    </View>
  );
}
