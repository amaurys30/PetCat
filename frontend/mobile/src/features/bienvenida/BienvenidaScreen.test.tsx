import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { BienvenidaScreen, LAMINAS } from "./BienvenidaScreen";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), canGoBack: () => true, replace: jest.fn() }),
}));

const carrusel = () => screen.getByTestId("carrusel-bienvenida");
const accion = (actionName: "increment" | "decrement") =>
  fireEvent(carrusel(), "accessibilityAction", { nativeEvent: { actionName } });

describe("M1 · Bienvenida", () => {
  beforeEach(() => mockPush.mockClear());

  it("tres láminas con los textos aprobados", () => {
    expect(LAMINAS.map((l) => l.titulo)).toEqual([
      "Todo lo de tu mascota, en tu bolsillo.",
      "Sus vacunas, siempre a mano.",
      "Agenda en la veterinaria de tu barrio.",
    ]);
    expect(LAMINAS[2]!.cuerpo).toBe(
      "Mira las horas libres, reserva en segundos y recibe un recordatorio el día antes.",
    );
  });

  it("para el lector es un control ajustable: lámina, título y texto; cambia con los gestos", async () => {
    await render(<BienvenidaScreen />);
    expect(carrusel()).toHaveProp("accessibilityRole", "adjustable");
    expect(carrusel()).toHaveAccessibilityValue({ text: "Lámina 1 de 3" });
    expect(carrusel()).toHaveProp("accessibilityLabel", `${LAMINAS[0]!.titulo} ${LAMINAS[0]!.cuerpo}`);

    await accion("increment");
    expect(carrusel()).toHaveAccessibilityValue({ text: "Lámina 2 de 3" });
    expect(carrusel()).toHaveProp("accessibilityLabel", `${LAMINAS[1]!.titulo} ${LAMINAS[1]!.cuerpo}`);

    await accion("increment");
    await accion("increment");
    expect(carrusel()).toHaveAccessibilityValue({ text: "Lámina 3 de 3" });

    await accion("decrement");
    expect(carrusel()).toHaveAccessibilityValue({ text: "Lámina 2 de 3" });
  });

  it("no avanza sola", async () => {
    jest.useFakeTimers();
    await render(<BienvenidaScreen />);
    await act(async () => jest.advanceTimersByTime(30_000));
    expect(carrusel()).toHaveAccessibilityValue({ text: "Lámina 1 de 3" });
    jest.useRealTimers();
  });

  it("las ilustraciones (pasaporte, sellos, mapa) quedan ocultas al lector", async () => {
    await render(<BienvenidaScreen />);
    for (const texto of ["Vacuna al día", "PASAPORTE PETCAT", "RABIA", "Mañana · 8:30 a. m."]) {
      expect(screen.queryByText(texto)).toBeNull();
      expect(screen.getByText(texto, { includeHiddenElements: true })).toBeTruthy();
    }
  });

  it("sin flecha Volver (es la entrada sin sesión); los botones llevan a registro y login", async () => {
    await render(<BienvenidaScreen />);
    expect(screen.queryByRole("button", { name: "Volver" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Crear mi cuenta" }));
    expect(mockPush).toHaveBeenLastCalledWith("/registro");
    await fireEvent.press(screen.getByRole("button", { name: "Ya tengo cuenta" }));
    expect(mockPush).toHaveBeenLastCalledWith("/login");
  });
});
