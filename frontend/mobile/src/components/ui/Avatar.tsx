import { Image } from "expo-image";
import { Cat, Dog, PawPrint, type LucideIcon } from "lucide-react-native";
import { View } from "react-native";

import { colors } from "@/theme/tokens";

import { Text } from "./Text";

const ICONO_ESPECIE: Record<string, LucideIcon> = { perro: Dog, gato: Cat };

const TAMANOS = { sm: 40, md: 56, lg: 88 } as const;

type Props = {
  /** Nombre de la persona o la mascota: da las iniciales y la etiqueta accesible. */
  nombre: string;
  uri?: string | null;
  /** Mascota sin foto: ilustración por especie en lugar de iniciales. */
  especie?: string;
  tamano?: keyof typeof TAMANOS;
};

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return partes
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function Avatar({ nombre, uri, especie, tamano = "md" }: Props) {
  const lado = TAMANOS[tamano];
  const Icono = especie ? (ICONO_ESPECIE[especie.toLowerCase()] ?? PawPrint) : null;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={uri ? `Foto de ${nombre}` : nombre}
      className="items-center justify-center overflow-hidden rounded-full bg-primary-soft"
      style={{ width: lado, height: lado }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: lado, height: lado }} contentFit="cover" accessible={false} />
      ) : Icono ? (
        <Icono size={lado * 0.5} color={colors["primary-deep"]} accessibilityElementsHidden />
      ) : (
        <Text
          variante={tamano === "sm" ? "apoyo" : "seccion"}
          accessibilityRole="none"
          maxFontSizeMultiplier={1.2}
          className="font-extrabold text-primary-deep"
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {iniciales(nombre)}
        </Text>
      )}
    </View>
  );
}
