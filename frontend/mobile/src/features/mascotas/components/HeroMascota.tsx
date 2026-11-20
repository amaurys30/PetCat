import { LinearGradient } from "expo-linear-gradient";
import { IdCard } from "lucide-react-native";
import { View } from "react-native";

import type { MascotaConResumen } from "@/api/types";
import { Avatar, Button, Text } from "@/components/ui";
import { formatearFecha } from "@/lib/formatos";
import { formatearEdad, formatearPeso, nombreEspecie } from "@/lib/mascotas";
import { colors } from "@/theme/tokens";

import { ChipSalud } from "./ChipSalud";

type Props = { mascota: MascotaConResumen; onAbrirPasaporte: () => void };

/**
 * Tarjeta principal de Inicio. Degradado de primary-strong a primary-deep: el texto blanco
 * cumple AA en todo el fondo (el teal de marca solo sería decorativo).
 */
export function HeroMascota({ mascota, onAbrirPasaporte }: Props) {
  const { resumen } = mascota;
  const detalle = [mascota.raza ?? nombreEspecie(mascota.especie), formatearEdad(mascota.edad_meses)]
    .filter(Boolean)
    .join(" · ");
  const vacunas = resumen.vacunas.vigentes
    ? `${resumen.vacunas.al_dia + resumen.vacunas.proximas} de ${resumen.vacunas.vigentes}`
    : "Sin registro";
  const proximo = resumen.proximos_eventos[0];
  const datos = [
    { etiqueta: "Peso", valor: formatearPeso(mascota.peso) ?? "Sin registro" },
    { etiqueta: "Vacunas", valor: vacunas, accesible: resumen.vacunas.vigentes ? `${vacunas} al día` : vacunas },
    { etiqueta: "Próxima", valor: proximo ? formatearFecha(proximo.fecha).replace(/^\S+ /, "") : "Nada próximo" },
  ];

  return (
    <LinearGradient
      colors={[colors["primary-strong"], colors["primary-deep"]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 24, padding: 20, gap: 16 }}
    >
      <View className="flex-row items-center gap-4">
        <View className="rounded-full bg-white p-1">
          <Avatar nombre={mascota.nombre} uri={mascota.foto_miniatura_url} especie={mascota.especie} tamano="lg" />
        </View>
        <View className="flex-1 gap-1">
          <Text variante="titulo" className="text-white">
            {mascota.nombre}
          </Text>
          {detalle ? <Text className="text-white">{detalle}</Text> : null}
          <ChipSalud estado={resumen.estado_vacunas} sobreColor />
        </View>
      </View>

      <View className="flex-row gap-2">
        {datos.map((d) => (
          <View
            key={d.etiqueta}
            accessible
            accessibilityLabel={`${d.etiqueta}: ${d.accesible ?? d.valor}`}
            className="flex-1 gap-0.5 rounded-control bg-black/20 p-3"
          >
            <Text variante="apoyo" className="text-white">
              {d.etiqueta}
            </Text>
            <Text variante="cuerpo" className="font-extrabold text-white" numberOfLines={2}>
              {d.valor}
            </Text>
          </View>
        ))}
      </View>

      <Button
        titulo="Abrir su Pasaporte PetCat"
        accessibilityLabel={`Abrir el Pasaporte PetCat de ${mascota.nombre}`}
        variante="claro"
        icono={IdCard}
        onPress={onAbrirPasaporte}
      />
    </LinearGradient>
  );
}
