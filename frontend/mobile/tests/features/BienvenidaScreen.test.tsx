import { fireEvent, render, screen } from "@testing-library/react-native";

import { BienvenidaScreen } from "@/features/bienvenida/screens/BienvenidaScreen";

const mockPush = jest.fn();

jest.mock("expo-router", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    useRouter: () => ({ push: mockPush, back: jest.fn() }),
    Link: ({ children, href: _href, ...props }: { children: string; href: string }) => (
      <Text {...props}>{children}</Text>
    ),
  };
});

describe("BienvenidaScreen (M1)", () => {
  beforeEach(() => mockPush.mockClear());

  it("muestra el título como encabezado y los dos botones", async () => {
    await render(<BienvenidaScreen />);
    expect(screen.getByRole("header", { name: "Todo lo de tu mascota, en tu bolsillo." })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Crear mi cuenta" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Ya tengo cuenta" })).toBeOnTheScreen();
  });

  it("lleva a crear cuenta y a iniciar sesión", async () => {
    await render(<BienvenidaScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Crear mi cuenta" }));
    expect(mockPush).toHaveBeenLastCalledWith("/registro");
    await fireEvent.press(screen.getByRole("button", { name: "Ya tengo cuenta" }));
    expect(mockPush).toHaveBeenLastCalledWith("/login");
  });

  it("oculta la ilustración decorativa a los lectores de pantalla", async () => {
    await render(<BienvenidaScreen />);
    expect(screen.queryByText("Vacuna al día")).toBeNull();
    expect(screen.getByText("Vacuna al día", { includeHiddenElements: true })).toBeTruthy();
  });
});
