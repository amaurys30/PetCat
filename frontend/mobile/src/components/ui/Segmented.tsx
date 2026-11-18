import { Pressable, View } from "react-native";

import { Text } from "./Text";

type Opcion<T extends string> = { valor: T; etiqueta: string };

type Props<T extends string> = {
  /** Nombre del grupo para lectores de pantalla ("Ver citas"). */
  etiqueta: string;
  opciones: Opcion<T>[];
  valor: T;
  onCambiar: (valor: T) => void;
  className?: string;
};

// Una sola opción activa: grupo de radios para los lectores de pantalla.
export function Segmented<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambiar,
  className = "",
}: Props<T>) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={etiqueta}
      className={`flex-row rounded-control bg-track p-1 ${className}`}
    >
      {opciones.map((opcion) => {
        const activa = opcion.valor === valor;
        return (
          <Pressable
            key={opcion.valor}
            accessibilityRole="radio"
            accessibilityLabel={opcion.etiqueta}
            accessibilityState={{ checked: activa, selected: activa }}
            onPress={() => onCambiar(opcion.valor)}
            className={`min-h-11 flex-1 items-center justify-center rounded-chip px-2 ${
              activa ? "bg-white shadow-sm" : ""
            }`}
          >
            <Text
              variante="apoyo"
              numberOfLines={1}
              className={activa ? "font-bold text-primary-deep" : "font-medium text-muted"}
            >
              {opcion.etiqueta}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
