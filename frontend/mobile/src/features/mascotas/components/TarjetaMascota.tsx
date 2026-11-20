import { LinearGradient } from "expo-linear-gradient";
import { IdCard } from "lucide-react-native";
import { Pressable, View } from "react-native";

import type { MascotaConResumen } from "@/api/types";
import { Avatar, Button, Text } from "@/components/ui";
import { formatearFecha } from "@/lib/formatos";
import { formatearEdad, nombreEspecie, nombreSexo, segunSexo, textoEstadoSalud } from "@/lib/mascotas";
import { colors } from "@/theme/tokens";

import { ChipDato, ChipSalud } from "./ChipSalud";

/** Cabecera por especie, con texto blanco AA en todo el degradado. */
const DEGRADADOS: Record<string, readonly [string, string]> = {
  perro: [colors["primary-strong"], colors["primary-deep"]],
  gato: [colors["lavender-ink"], colors["passport-to"]],
};
const OTRO: readonly [string, string] = [colors["coral-dark"], colors["passport-to"]];

/** "Perro · Golden · Macho · 3 años". */
export const lineaMascota = (m: MascotaConResumen) =>
  [
    nombreEspecie(m.especie),
    m.raza,
    m.sexo !== "desconocido" ? nombreSexo(m.sexo) : null,
    formatearEdad(m.edad_meses),
  ]
    .filter(Boolean)
    .join(" · ");

/** Etiqueta única de la tarjeta para el lector de pantalla. */
export function etiquetaMascota(m: MascotaConResumen): string {
  const partes = [`${m.nombre}, ${lineaMascota(m)}.`];
  if (m.fallecido) partes.push("En memoria.");
  const salud = textoEstadoSalud(m.resumen.estado_vacunas);
  if (salud) partes.push(`${salud}.`);
  if (m.resumen.proxima_cita) partes.push(`Próxima cita el ${formatearFecha(m.resumen.proxima_cita.fecha)}.`);
  partes.push("Ver ficha.");
  return partes.join(" ");
}

type Props = { mascota: MascotaConResumen; onAbrir: () => void; onCarnet: () => void };

/** Tarjeta de M5. Tocarla abre la ficha; el botón Carnet va aparte (nunca anidado en la tarjeta). */
export function TarjetaMascota({ mascota: m, onAbrir, onCarnet }: Props) {
  const colores = DEGRADADOS[m.especie] ?? OTRO;
  const { resumen } = m;
  const pendientes = resumen.vacunas.proximas + resumen.vacunas.vencidas;

  return (
    <View className="overflow-hidden rounded-card border border-border bg-white">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={etiquetaMascota(m)}
        onPress={onAbrir}
        className="active:opacity-90"
      >
        <LinearGradient colors={colores} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16 }}>
          <View className="flex-row items-center gap-4">
            <View className="rounded-full bg-white p-1">
              <Avatar nombre={m.nombre} uri={m.foto_miniatura_url} especie={m.especie} tamano="md" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variante="titulo" className="text-white">
                {m.nombre}
              </Text>
              <Text className="text-white">{lineaMascota(m)}</Text>
            </View>
          </View>
        </LinearGradient>
        <View className="flex-row flex-wrap gap-2 px-4 pt-4">
          {m.fallecido ? (
            <ChipDato texto="En memoria" tono="memoria" />
          ) : pendientes > 0 ? (
            <ChipDato
              texto={pendientes === 1 ? "1 vacuna pendiente" : `${pendientes} vacunas pendientes`}
              tono="coral"
            />
          ) : (
            <ChipSalud estado={resumen.estado_vacunas} />
          )}
          {m.microchip && <ChipDato texto="Microchip" tono="info" />}
          {resumen.proxima_cita && (
            <ChipDato
              texto={`Cita ${formatearFecha(resumen.proxima_cita.fecha).replace(/^\S+ /, "")}`}
              tono="coral"
            />
          )}
          {m.esterilizado && <ChipDato texto={segunSexo(m.sexo, "Esterilizado", "Esterilizada")} />}
        </View>
      </Pressable>
      <View className="flex-row px-4 pb-4 pt-3">
        <Button
          titulo="Carnet"
          accessibilityLabel={`Carnet de ${m.nombre}`}
          variante="suave"
          icono={IdCard}
          onPress={onCarnet}
          className="flex-1"
        />
      </View>
    </View>
  );
}
