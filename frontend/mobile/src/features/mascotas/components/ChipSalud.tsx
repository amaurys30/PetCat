import { CircleAlert, CircleCheck, Clock, type LucideIcon } from "lucide-react-native";
import { View } from "react-native";

import type { ResumenMascota } from "@/api/types";
import { Text } from "@/components/ui";
import { textoEstadoSalud } from "@/lib/mascotas";
import { colors } from "@/theme/tokens";

// Estado de salud con ícono y texto (nunca solo color). Texto AA sobre su fondo.
const ESTILOS: Record<string, { caja: string; texto: string; color: string; icono: LucideIcon }> = {
  al_dia: {
    caja: "bg-primary-soft",
    texto: "text-primary-deep",
    color: colors["primary-deep"],
    icono: CircleCheck,
  },
  proximo: { caja: "bg-sun-soft", texto: "text-sun-ink", color: colors["sun-ink"], icono: Clock },
  vencido: {
    caja: "bg-danger-soft",
    texto: "text-danger-ink",
    color: colors["danger-ink"],
    icono: CircleAlert,
  },
  sin_vacunas: { caja: "bg-track", texto: "text-muted", color: colors.muted, icono: CircleAlert },
};

type Props = { estado: ResumenMascota["estado_vacunas"]; sobreColor?: boolean };

/** `sobreColor`: dentro de la tarjeta de color (fondo blanco y texto oscuro para el contraste). */
export function ChipSalud({ estado, sobreColor = false }: Props) {
  const texto = textoEstadoSalud(estado);
  if (!estado || !texto) return null;
  const estilo = ESTILOS[estado]!;
  const Icono = estilo.icono;
  return (
    <View
      className={`flex-row items-center gap-1.5 self-start rounded-full px-3 py-1.5 ${sobreColor ? "bg-white" : estilo.caja}`}
    >
      <Icono size={16} color={estilo.color} accessibilityElementsHidden />
      <Text variante="apoyo" className={`font-bold ${estilo.texto}`}>
        {texto}
      </Text>
    </View>
  );
}

/** Chip informativo genérico ("Microchip", "Esterilizada", "Cita 15 nov"). */
export function ChipDato({
  texto,
  tono = "neutro",
}: {
  texto: string;
  tono?: "neutro" | "info" | "coral" | "memoria";
}) {
  const estilos = {
    neutro: "bg-track text-ink",
    info: "bg-info-soft text-info-ink",
    coral: "bg-coral-soft text-coral-dark",
    memoria: "bg-lavender-soft text-lavender-ink",
  }[tono];
  const [caja, color] = estilos.split(" ");
  return (
    <View className={`self-start rounded-full px-3 py-1.5 ${caja}`}>
      <Text variante="apoyo" className={`font-semibold ${color}`}>
        {texto}
      </Text>
    </View>
  );
}
