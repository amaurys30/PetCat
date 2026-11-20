import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Button } from "./Button";
import { PantallaFormulario } from "./PantallaFormulario";

// Vistas con testID: sus props (bottomOffset, offset) quedan en el elemento para revisarlas.
jest.mock("react-native-keyboard-controller", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock no admite import
  const { View } = require("react-native");
  return {
    KeyboardAwareScrollView: (props: object) => <View testID="desplazable" {...props} />,
    KeyboardStickyView: (props: object) => <View testID="pie-fijo" {...props} />,
  };
});

const area = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 40, left: 0, right: 0, bottom: 24 },
};

function pantalla(pie?: React.ReactNode) {
  return render(
    <SafeAreaProvider initialMetrics={area}>
      <PantallaFormulario pie={pie}>
        <Text>Campos</Text>
      </PantallaFormulario>
    </SafeAreaProvider>,
  );
}

describe("PantallaFormulario con el teclado", () => {
  it("el campo con foco queda visible con margen por encima del teclado y del pie", async () => {
    await pantalla(<Button titulo="Guardar" onPress={() => {}} />);
    expect(screen.getByTestId("desplazable").props.bottomOffset).toBe(24);
    expect(screen.getByTestId("desplazable").props.keyboardShouldPersistTaps).toBe("handled");

    // El pie mide 88: el margen pasa a contarlo.
    const pie = screen.getByTestId("pie-fijo").children[0] as Parameters<typeof fireEvent>[0];
    await fireEvent(pie, "layout", { nativeEvent: { layout: { height: 88 } } });
    expect(screen.getByTestId("desplazable").props.bottomOffset).toBe(24 + 88);
  });

  it("el botón principal va en el pie, que sube con el teclado (el área segura ya la cubre el teclado)", async () => {
    await pantalla(<Button titulo="Guardar" onPress={() => {}} />);
    expect(screen.getByTestId("pie-fijo").props.offset).toEqual({ opened: 24 - 8 });
    expect(screen.getByRole("button", { name: "Guardar" })).toBeOnTheScreen();
  });

  it("sin pie no hay vista fija", async () => {
    await pantalla();
    expect(screen.queryByTestId("pie-fijo")).toBeNull();
  });
});
