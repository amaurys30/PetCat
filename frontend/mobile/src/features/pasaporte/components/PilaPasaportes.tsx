import { useEffect, useRef } from "react";
import { AccessibilityInfo, FlatList, useWindowDimensions, View } from "react-native";

import type { MascotaConResumen } from "@/api/types";
import { colors, radii } from "@/theme/tokens";

import { etiquetaTarjeta, type Anillo } from "../logica";
import { TarjetaPasaporte } from "./TarjetaPasaporte";

type Props = {
  mascotas: MascotaConResumen[];
  indice: number;
  onCambiar: (indice: number) => void;
  /** Anillo de la mascota del frente (para su etiqueta); las demás se leen sin él. */
  anillo: Anillo | null;
};

const MARGEN = 20;
const ASOMO = 14; // cuánto asoma la tarjeta de atrás

/**
 * Pila de pasaportes: se desliza de lado entre mascotas (FlatList paginada, desplazamiento nativo).
 * Con varias, para el lector es un control ajustable ("Mascota 1 de 2"): deslizar hacia arriba o
 * hacia abajo cambia de mascota. La tarjeta que asoma detrás es decorativa.
 */
export function PilaPasaportes({ mascotas, indice, onCambiar, anillo }: Props) {
  const { width } = useWindowDimensions();
  const lista = useRef<FlatList<MascotaConResumen>>(null);
  const varias = mascotas.length > 1;

  // Llega con la mascota elegida en Inicio (o tras cambiarla con el lector).
  useEffect(() => {
    lista.current?.scrollToIndex({ index: indice, animated: false });
  }, [indice]);

  const ir = (nuevo: number) => {
    if (nuevo < 0 || nuevo >= mascotas.length) return;
    onCambiar(nuevo);
    AccessibilityInfo.announceForAccessibility(mascotas[nuevo]!.nombre);
  };

  const actual = mascotas[indice];
  const contenido = (
    <FlatList
      ref={lista}
      data={mascotas}
      keyExtractor={(m) => String(m.id_mascota)}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={indice}
      getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
      onMomentumScrollEnd={(e) => {
        const nuevo = Math.round(e.nativeEvent.contentOffset.x / width);
        if (nuevo !== indice && mascotas[nuevo]) onCambiar(nuevo);
      }}
      // Con el lector, la pila entera es un solo control: las tarjetas no se recorren una a una.
      importantForAccessibility={varias ? "no-hide-descendants" : "auto"}
      accessibilityElementsHidden={varias}
      renderItem={({ item, index }) => {
        const siguiente = mascotas[index + 1];
        return (
          <View style={{ width, paddingHorizontal: MARGEN, paddingTop: ASOMO }}>
            {siguiente && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0,
                  left: MARGEN + 24,
                  right: MARGEN + 24,
                  height: 60,
                  borderRadius: radii.passport,
                  backgroundColor: siguiente.fallecido
                    ? colors["pasaporte-memoria-from"]
                    : colors["pasaporte-carta-to"],
                  opacity: 0.7,
                }}
              />
            )}
            <TarjetaPasaporte
              mascota={item}
              anillo={index === indice ? anillo : null}
              activo={index === indice}
            />
          </View>
        );
      }}
    />
  );

  const puntos = varias && (
    <View
      className="flex-row justify-center gap-2 pt-3"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {mascotas.map((m, i) => (
        <View
          key={m.id_mascota}
          className="h-2 rounded-full"
          style={{
            width: i === indice ? 24 : 8,
            backgroundColor: i === indice ? colors.white : colors["pasaporte-borde"],
          }}
        />
      ))}
    </View>
  );

  if (!varias || !actual) {
    return (
      <View>
        {contenido}
        {puntos}
      </View>
    );
  }

  return (
    <View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={etiquetaTarjeta(actual, anillo)}
        accessibilityValue={{ text: `Mascota ${indice + 1} de ${mascotas.length}` }}
        accessibilityHint="Desliza hacia arriba o hacia abajo para cambiar de mascota"
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => ir(indice + (e.nativeEvent.actionName === "increment" ? 1 : -1))}
        testID="pila-pasaportes"
      >
        {contenido}
      </View>
      {puntos}
    </View>
  );
}
