import { fireEvent, screen } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import { Text } from "react-native";

import TabsLayout from "../../../app/(tabs)/_layout";

// Las pestañas reales con pantallas mínimas: lo que se prueba es la barra y la navegación.
const pantalla = (nombre: string) =>
  function Pantalla() {
    return <Text>Pantalla {nombre}</Text>;
  };

function renderPestanas() {
  return renderRouter(
    {
      "(tabs)/_layout": TabsLayout,
      "(tabs)/index": pantalla("Inicio"),
      "(tabs)/explorar": pantalla("Explorar"),
      "(tabs)/carnet": pantalla("Carnet"),
      "(tabs)/citas": pantalla("Citas"),
      "(tabs)/perfil": pantalla("Perfil"),
    },
    { initialUrl: "/" },
  );
}

describe("TabBar", () => {
  it("muestra las 5 pestañas en orden, con Inicio seleccionada", async () => {
    await renderPestanas();
    const pestanas = screen.getAllByRole("tab");
    expect(pestanas.map((p) => p.props.accessibilityLabel)).toEqual([
      "Inicio",
      "Explorar",
      "Carnet de mis mascotas",
      "Citas",
      "Perfil",
    ]);
    expect(screen.getByRole("tab", { name: "Inicio" })).toBeSelected();
    // La lista no es "accessible" (agruparía las pestañas en un solo elemento): se busca por etiqueta.
    expect(screen.getByLabelText("Navegación principal")).toHaveProp("accessibilityRole", "tablist");
  });

  it("el Carnet es accesible por su etiqueta y lleva a su pantalla", async () => {
    await renderPestanas();
    await fireEvent.press(screen.getByRole("tab", { name: "Carnet de mis mascotas" }));
    expect(screen).toHavePathname("/carnet");
    expect(screen.getByText("Pantalla Carnet")).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "Carnet de mis mascotas" })).toBeSelected();
    expect(screen.getByRole("tab", { name: "Inicio" })).not.toBeSelected();
  });

  it("navega entre las pestañas", async () => {
    await renderPestanas();
    for (const [nombre, ruta] of [
      ["Explorar", "/explorar"],
      ["Citas", "/citas"],
      ["Perfil", "/perfil"],
      ["Inicio", "/"],
    ] as const) {
      await fireEvent.press(screen.getByRole("tab", { name: nombre }));
      expect(screen).toHavePathname(ruta);
      expect(screen.getByRole("tab", { name: nombre })).toBeSelected();
    }
  });

  it("deja una franja transparente arriba para que el círculo del Carnet reciba toques", async () => {
    await renderPestanas();
    const barra = screen.getByTestId("tab-bar");
    expect(barra.props.pointerEvents).toBe("box-none");
    expect(barra).toHaveStyle({ paddingTop: 20 });
  });
});
