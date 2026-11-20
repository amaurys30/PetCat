import { LinearGradient } from "expo-linear-gradient";
import { PawPrint } from "lucide-react-native";
import { useWindowDimensions, View } from "react-native";

import type { MascotaConResumen } from "@/api/types";
import { Avatar, Text } from "@/components/ui";
import { formatearFecha } from "@/lib/formatos";
import { ChipSalud } from "@/features/mascotas/components/ChipSalud";
import { colors, radii } from "@/theme/tokens";

import { Holograma } from "../efecto";
import { especieYRaza, etiquetaTarjeta, lineaMrz, microchipEnGrupos, type Anillo } from "../logica";

type Props = {
  mascota: MascotaConResumen;
  anillo: Anillo | null;
  /** La tarjeta del frente: solo ella tiene el efecto con el sensor. */
  activo: boolean;
};

function Campo({ rotulo, valor, colorRotulo }: { rotulo: string; valor: string; colorRotulo: string }) {
  return (
    <View className="gap-0.5" style={{ flexShrink: 1 }}>
      <Text variante="rotulo" className="font-bold" style={{ color: colorRotulo, letterSpacing: 0.6 }}>
        {rotulo}
      </Text>
      <Text variante="cuerpoMedio" className="text-white">
        {valor}
      </Text>
    </View>
  );
}

/**
 * M7 · Tarjeta del Pasaporte PetCat. Para el lector es un solo elemento con todo en texto
 * (etiquetaTarjeta); el emblema, el brillo y la línea tipo pasaporte son decorativos.
 * Sin alto fijo: con texto grande (fontScale ≥ 1,3) los datos van en una columna.
 * Sin QR hasta M7 (enlace público) ni insignia "Verificado" (no hay una regla real que la respalde).
 */
export function TarjetaPasaporte({ mascota: m, anillo, activo }: Props) {
  const { fontScale } = useWindowDimensions();
  const enColumna = fontScale >= 1.3;
  const memoria = m.fallecido;
  const degradado = memoria
    ? ([colors["pasaporte-memoria-from"], colors["pasaporte-memoria-to"]] as const)
    : ([colors["pasaporte-carta-from"], colors["pasaporte-carta-to"]] as const);
  const rotulo = memoria ? colors["pasaporte-memoria-rotulo"] : colors["pasaporte-rotulo"];

  return (
    <Holograma activo={activo} radio={radii.passport}>
      <LinearGradient
        colors={degradado}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: radii.passport, padding: 20, gap: 16, overflow: "hidden" }}
      >
        <View
          accessible
          accessibilityLabel={etiquetaTarjeta(m, anillo)}
          testID={`tarjeta-${m.id_mascota}`}
          className="gap-4"
        >
          <View className="flex-row items-start justify-between gap-3">
            <View>
              <Text variante="apoyo" className="font-extrabold text-white" style={{ letterSpacing: 1 }}>
                PASAPORTE PETCAT
              </Text>
              <Text variante="rotulo" style={{ color: rotulo }}>
                Colombia
              </Text>
            </View>
            {/* Emblema decorativo en lugar del QR (llega con el enlace público, M7). */}
            <View
              className="h-11 w-11 items-center justify-center rounded-full border-2"
              style={{ borderColor: rotulo, opacity: 0.8 }}
            >
              <PawPrint size={20} color={rotulo} />
            </View>
          </View>

          <View className="flex-row items-center gap-4">
            <View
              className="rounded-[22px] p-1"
              style={{ backgroundColor: memoria ? rotulo : colors["pasaporte-numero"] }}
            >
              <Avatar nombre={m.nombre} uri={m.foto_url} especie={m.especie} tamano="lg" />
            </View>
            <View className="flex-1 gap-1">
              <Text variante="titulo" className="text-white" numberOfLines={2}>
                {m.nombre}
              </Text>
              <Text
                variante="apoyo"
                className="font-bold"
                style={{ color: memoria ? rotulo : colors["pasaporte-numero"] }}
              >
                {`N.º ${m.codigo_pasaporte}`}
              </Text>
              {memoria ? (
                <View className="self-start rounded-full bg-white px-3 py-1">
                  <Text variante="apoyo" className="font-bold text-lavender-ink">
                    {m.fecha_fallecimiento
                      ? `En memoria · ${formatearFecha(m.fecha_fallecimiento, { anio: true })}`
                      : "En memoria"}
                  </Text>
                </View>
              ) : (
                <ChipSalud estado={m.resumen.estado_vacunas} sobreColor />
              )}
            </View>
          </View>

          <View className={enColumna ? "gap-3" : "flex-row justify-between gap-3"}>
            <Campo rotulo="ESPECIE" valor={especieYRaza(m)} colorRotulo={rotulo} />
            <Campo
              rotulo="NACIMIENTO"
              valor={
                m.fecha_nacimiento
                  ? formatearFecha(m.fecha_nacimiento, { anio: true }).replace(/^\S+ /, "")
                  : "Sin registrar"
              }
              colorRotulo={rotulo}
            />
            <Campo
              rotulo="MICROCHIP"
              valor={m.microchip ? microchipEnGrupos(m.microchip) : "Sin registrar"}
              colorRotulo={rotulo}
            />
          </View>

          <Text
            variante="rotulo"
            numberOfLines={1}
            maxFontSizeMultiplier={1}
            importantForAccessibility="no"
            accessibilityElementsHidden
            style={{ color: rotulo, letterSpacing: 1.5, opacity: 0.85 }}
          >
            {lineaMrz(m)}
          </Text>
        </View>
      </LinearGradient>
    </Holograma>
  );
}
