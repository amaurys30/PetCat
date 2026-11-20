import { useState, type ComponentRef, type Ref } from "react";
import { Pressable, TextInput, View } from "react-native";

import { Input, Text } from "@/components/ui";

import { buscarRazas } from "../razas";

type Props = {
  especie: string | undefined;
  valor: string;
  onCambiar: (raza: string) => void;
  onBlur?: () => void;
  error?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
};

/** Raza: texto libre con sugerencias locales (perro y gato) mientras se escribe. */
export function CampoRaza({ especie, valor, onCambiar, onBlur, error, ref }: Props) {
  const [enfocado, setEnfocado] = useState(false);
  const sugerencias = enfocado && especie ? buscarRazas(especie, valor) : [];

  return (
    <View className="gap-2">
      <Input
        ref={ref}
        etiqueta="Raza (opcional)"
        placeholder={especie === "perro" || especie === "gato" ? "Busca la raza…" : "Escribe la raza"}
        value={valor}
        onChangeText={onCambiar}
        onFocus={() => setEnfocado(true)}
        onBlur={() => {
          setEnfocado(false);
          onBlur?.();
        }}
        error={error}
        autoCapitalize="words"
        maxLength={100}
      />
      {sugerencias.length > 0 && (
        <View className="overflow-hidden rounded-control border border-border bg-white" accessibilityLiveRegion="polite">
          {sugerencias.map((raza) => (
            <Pressable
              key={raza}
              accessibilityRole="button"
              accessibilityLabel={`Sugerencia: ${raza}`}
              onPress={() => onCambiar(raza)}
              className="min-h-12 justify-center border-b border-border px-4 active:bg-track"
            >
              <Text>{raza}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
