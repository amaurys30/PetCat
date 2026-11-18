import { LinearGradient } from "expo-linear-gradient";
import { Bell, CalendarDays, Check, Dog, PawPrint, Plus, Star, Syringe } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/components/ui";
import { colors } from "@/theme/tokens";

// Ilustraciones de la bienvenida armadas con componentes (las finales llegan desde Figma).
// Son decorativas: el contenedor las oculta al lector de pantalla, que lee el título de la lámina.
// Los textos dentro no crecen con el tamaño de letra del sistema para no romper el dibujo.

const MAX_ESCALA = 1.1;

function Lienzo({ children }: { children: ReactNode }) {
  return (
    <View
      className="h-80 w-full items-center justify-center"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View className="h-72 w-72 items-center justify-center rounded-full bg-white/10">
        <View className="h-52 w-52 rounded-full bg-white/15" />
      </View>
      {children}
    </View>
  );
}

function Pastilla({ icono, children, className }: { icono: ReactNode; children: string; className: string }) {
  return (
    <View className={`absolute flex-row items-center gap-2 rounded-full bg-white px-4 py-2 ${className}`}>
      {icono}
      <Text variante="apoyo" maxFontSizeMultiplier={MAX_ESCALA} className="font-bold text-primary-deep">
        {children}
      </Text>
    </View>
  );
}

/** Lámina 1: la mascota con su vacuna al día y su próxima cita. */
export function IlustracionMascota() {
  return (
    <Lienzo>
      <View className="absolute h-36 w-36 items-center justify-center rounded-full bg-white">
        <Dog size={72} color={colors["primary-strong"]} strokeWidth={1.75} />
      </View>
      <Pastilla className="right-2 top-8" icono={<Syringe size={16} color={colors["primary-strong"]} />}>
        Vacuna al día
      </Pastilla>
      <Pastilla
        className="bottom-12 left-2"
        icono={<CalendarDays size={16} color={colors["primary-strong"]} />}
      >
        Mañana · 8:00
      </Pastilla>
      <View className="absolute bottom-10 right-8 h-14 w-14 items-center justify-center rounded-full bg-sun">
        <PawPrint size={24} color={colors.ink} />
      </View>
    </Lienzo>
  );
}

function Sello({ texto, color, className }: { texto: string; color: string; className: string }) {
  return (
    <View
      className={`absolute h-20 w-20 items-center justify-center rounded-full border-2 border-dashed bg-white ${className}`}
      style={{ borderColor: color }}
    >
      <Check size={16} color={color} strokeWidth={3} />
      <Text variante="rotulo" maxFontSizeMultiplier={MAX_ESCALA} className="font-extrabold" style={{ color }}>
        {texto}
      </Text>
    </View>
  );
}

// QR dibujado: un patrón fijo de módulos, con las tres esquinas de posición.
const QR = ["1110111", "1010101", "1110111", "0101010", "1110101", "1010110", "1110011"];

function QrMiniatura() {
  return (
    <View className="rounded-lg bg-white p-1.5">
      {QR.map((fila, i) => (
        <View key={i} className="flex-row">
          {fila.split("").map((m, j) => (
            <View key={j} className={`h-1.5 w-1.5 ${m === "1" ? "bg-ink" : "bg-white"}`} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Lámina 2: el Pasaporte PetCat en miniatura con sus sellos de vacunas. */
export function IlustracionPasaporte() {
  return (
    <Lienzo>
      <View className="absolute" style={{ transform: [{ rotate: "-6deg" }] }}>
        <LinearGradient
          colors={[colors["passport-from"], colors["primary-deep"], colors["lavender-ink"]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 260, borderRadius: 20, padding: 14, gap: 8 }}
        >
          <Text variante="rotulo" maxFontSizeMultiplier={MAX_ESCALA} className="font-extrabold text-white">
            PASAPORTE PETCAT
          </Text>
          <View className="flex-row items-center gap-3">
            <View className="h-14 w-14 items-center justify-center rounded-xl border-2 border-sun bg-white">
              <Dog size={30} color={colors["primary-strong"]} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variante="seccion" maxFontSizeMultiplier={MAX_ESCALA} className="text-white">
                Max
              </Text>
              <Text variante="rotulo" maxFontSizeMultiplier={MAX_ESCALA} className="text-sun">
                N.º PC-2025-00042
              </Text>
              <View className="mt-1 flex-row items-center gap-1 self-start rounded-full bg-white/15 px-2 py-0.5">
                <View className="h-1.5 w-1.5 rounded-full bg-primary" />
                <Text variante="rotulo" maxFontSizeMultiplier={MAX_ESCALA} className="text-white">
                  Salud al día
                </Text>
              </View>
            </View>
          </View>
          <View className="flex-row items-end justify-between">
            <Text
              variante="rotulo"
              maxFontSizeMultiplier={MAX_ESCALA}
              className="text-white/80"
              style={{ letterSpacing: 1 }}
            >
              {"PC<COL<MAX<<GOLDEN<<<"}
            </Text>
            <QrMiniatura />
          </View>
        </LinearGradient>
      </View>
      <Sello texto="RABIA" color={colors["primary-strong"]} className="left-4 top-4" />
      <Sello texto="MÚLTIPLE" color={colors["coral-dark"]} className="right-2 top-10" />
      <Sello texto="PARVO" color={colors["lavender-ink"]} className="bottom-14 right-6" />
      <Pastilla className="bottom-6 left-4" icono={<Syringe size={16} color={colors["primary-strong"]} />}>
        Sello nuevo · Rabia
      </Pastilla>
    </Lienzo>
  );
}

/** Lámina 3: un mapa simplificado con la ruta a la veterinaria y las horas libres. */
export function IlustracionAgenda() {
  const manzanas = [
    "left-3 top-6",
    "left-20 top-6",
    "right-3 top-6",
    "left-3 top-28",
    "right-3 top-28",
    "left-20 bottom-6",
    "right-3 bottom-6",
  ];
  return (
    <Lienzo>
      <View className="absolute h-56 w-56 overflow-hidden rounded-full border-4 border-white bg-track">
        {manzanas.map((pos, i) => (
          <View
            key={pos}
            className={`absolute h-16 w-14 rounded-lg ${i % 3 === 1 ? "bg-primary-soft" : "bg-white"} ${pos}`}
          />
        ))}
        {/* Avenida */}
        <View
          className="absolute -left-6 bottom-12 h-5 w-72 bg-sun-soft"
          style={{ transform: [{ rotate: "-18deg" }] }}
        />
        {/* Ruta punteada de "mi ubicación" a la veterinaria */}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <View
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-primary-deep"
            style={{ left: 64 + i * 9, top: 150 - i * 15 }}
          />
        ))}
        <View
          className="absolute h-4 w-4 rounded-full border-2 border-white bg-info"
          style={{ left: 54, top: 154 }}
        />
      </View>
      <View className="absolute top-10 flex-row items-center gap-2 rounded-full border-2 border-white bg-coral px-2 py-1.5">
        <View className="h-7 w-7 items-center justify-center rounded-full bg-white">
          <Plus size={16} color={colors["coral-dark"]} strokeWidth={3} />
        </View>
        <Text variante="apoyo" maxFontSizeMultiplier={MAX_ESCALA} className="font-extrabold text-coral-ink">
          4,9
        </Text>
        <Star size={14} color={colors["coral-ink"]} fill={colors["coral-ink"]} />
      </View>
      <Pastilla className="left-0 top-0" icono={<Bell size={16} color={colors["primary-strong"]} />}>
        Mañana · 8:30 a. m.
      </Pastilla>
      <View className="absolute bottom-0 right-0 gap-2 rounded-card bg-white p-3">
        <Text variante="rotulo" maxFontSizeMultiplier={MAX_ESCALA} className="text-muted">
          Mañana · mar 18
        </Text>
        <View className="flex-row gap-2">
          {["8:30", "9:00", "9:30"].map((hora, i) => (
            <View
              key={hora}
              className={`rounded-chip px-3 py-1.5 ${i === 0 ? "bg-primary-strong" : "border border-border bg-white"}`}
            >
              <Text
                variante="apoyo"
                maxFontSizeMultiplier={MAX_ESCALA}
                className={`font-bold ${i === 0 ? "text-white" : "text-ink"}`}
              >
                {hora}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Lienzo>
  );
}
