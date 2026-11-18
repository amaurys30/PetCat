import { resolverApiUrl } from "@/api/origen";

describe("resolverApiUrl", () => {
  it("usa EXPO_PUBLIC_API_URL si está definida, sin la barra final", () => {
    expect(
      resolverApiUrl({
        envUrl: "http://localhost:3001/api/v1/",
        hostUri: "192.168.1.5:8081",
        plataforma: "android",
      }),
    ).toBe("http://localhost:3001/api/v1");
  });

  it("ignora una EXPO_PUBLIC_API_URL vacía", () => {
    expect(resolverApiUrl({ envUrl: "  ", hostUri: "192.168.1.5:8081", plataforma: "ios" })).toBe(
      "http://192.168.1.5:3001/api/v1",
    );
  });

  it("en desarrollo usa la IP del servidor de Expo con el puerto de la API de demo", () => {
    expect(resolverApiUrl({ hostUri: "192.168.0.20:8081", plataforma: "android" })).toBe(
      "http://192.168.0.20:3001/api/v1",
    );
  });

  it("no usa el host del túnel de Expo", () => {
    expect(resolverApiUrl({ hostUri: "abc-anonymous-8081.exp.direct", plataforma: "ios" })).toBe(
      "http://localhost:3001/api/v1",
    );
  });

  it("sin host usa 10.0.2.2 en Android (emulador) y localhost en el resto", () => {
    expect(resolverApiUrl({ hostUri: null, plataforma: "android" })).toBe("http://10.0.2.2:3001/api/v1");
    expect(resolverApiUrl({ plataforma: "ios" })).toBe("http://localhost:3001/api/v1");
  });
});
