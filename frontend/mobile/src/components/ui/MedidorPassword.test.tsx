import { render, screen } from "@testing-library/react-native";

import { MedidorPassword, nivelPassword } from "./MedidorPassword";

describe("nivelPassword", () => {
  it.each([
    ["", 0],
    ["corta", 0],
    ["solotexto", 1],
    ["Clave1234", 2],
    ["claveLarga12345", 3],
    ["Clave1234!", 3],
  ])("%j → %i", (password, nivel) => {
    expect(nivelPassword(password)).toBe(nivel);
  });
});

describe("MedidorPassword", () => {
  it("el nivel va en texto, no solo en color", async () => {
    await render(<MedidorPassword password="Clave1234" />);
    expect(screen.getByLabelText("Seguridad de la contraseña: Buena")).toBeOnTheScreen();
  });

  it("vacío no muestra nada", async () => {
    await render(<MedidorPassword password="" />);
    expect(screen.toJSON()).toBeNull();
  });
});
