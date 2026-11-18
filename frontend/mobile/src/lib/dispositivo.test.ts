import { nombreDispositivo } from "./dispositivo";

describe("nombreDispositivo", () => {
  it("marca, modelo y sistema", () => {
    expect(
      nombreDispositivo({
        manufacturer: "samsung",
        modelName: "SM-A515F",
        osName: "Android",
        osVersion: "14",
      }),
    ).toBe("samsung SM-A515F · Android 14");
    expect(
      nombreDispositivo({ manufacturer: "Apple", modelName: "iPhone 15", osName: "iOS", osVersion: "18.1" }),
    ).toBe("Apple iPhone 15 · iOS 18.1");
  });

  it("no repite la marca si el modelo ya la trae", () => {
    expect(
      nombreDispositivo({
        manufacturer: "Google",
        modelName: "Google Pixel 8",
        osName: "Android",
        osVersion: "15",
      }),
    ).toBe("Google Pixel 8 · Android 15");
  });

  it("sin datos (emulador o permisos): un nombre genérico; nunca más de 200 caracteres", () => {
    expect(nombreDispositivo({})).toBe("Dispositivo móvil");
    expect(nombreDispositivo({ modelName: "x".repeat(300) })).toHaveLength(200);
  });
});
