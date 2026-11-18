import { fireEvent, render, screen } from "@testing-library/react-native";

import { BienvenidaScreen } from "./BienvenidaScreen";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), canGoBack: () => true, replace: jest.fn() }),
}));

describe("BienvenidaScreen (M1, estática en M0)", () => {
  beforeEach(() => mockPush.mockClear());

  it("título como encabezado y los dos botones", async () => {
    await render(<BienvenidaScreen />);
    expect(screen.getByRole("header", { name: "Todo lo de tu mascota, en tu bolsillo." })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Crear mi cuenta" }));
    expect(mockPush).toHaveBeenLastCalledWith("/registro");
    await fireEvent.press(screen.getByRole("button", { name: "Ya tengo cuenta" }));
    expect(mockPush).toHaveBeenLastCalledWith("/login");
  });

  it("la ilustración decorativa queda oculta a los lectores", async () => {
    await render(<BienvenidaScreen />);
    expect(screen.queryByText("Vacuna al día")).toBeNull();
    expect(screen.getByText("Vacuna al día", { includeHiddenElements: true })).toBeTruthy();
  });
});
