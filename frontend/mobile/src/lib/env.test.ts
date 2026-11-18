import { env, leerEnv } from "./env";

const android = { plataforma: "android" };

describe("leerEnv", () => {
  it("usa EXPO_PUBLIC_API_URL sin la barra final y deriva el socket del origen", () => {
    expect(
      leerEnv(
        { EXPO_PUBLIC_API_URL: "http://192.168.1.50:3001/api/v1/" },
        { ...android, hostUri: "10.0.0.2:8081" },
      ),
    ).toEqual({ apiUrl: "http://192.168.1.50:3001/api/v1", socketUrl: "http://192.168.1.50:3001" });
  });

  it("respeta EXPO_PUBLIC_SOCKET_URL", () => {
    const resultado = leerEnv(
      { EXPO_PUBLIC_API_URL: "https://api.petcat.co/api/v1", EXPO_PUBLIC_SOCKET_URL: "https://rt.petcat.co" },
      android,
    );
    expect(resultado.socketUrl).toBe("https://rt.petcat.co");
  });

  it("sin variable usa la IP del servidor de Expo con el puerto 3001", () => {
    expect(leerEnv({ EXPO_PUBLIC_API_URL: "" }, { ...android, hostUri: "192.168.0.20:8081" }).apiUrl).toBe(
      "http://192.168.0.20:3001/api/v1",
    );
  });

  it("no usa el host del túnel de Expo; sin host, 10.0.2.2 en Android y localhost en iOS", () => {
    expect(leerEnv({}, { ...android, hostUri: "abc-8081.exp.direct" }).apiUrl).toBe(
      "http://10.0.2.2:3001/api/v1",
    );
    expect(leerEnv({}, { plataforma: "ios" }).apiUrl).toBe("http://localhost:3001/api/v1");
  });

  it("rechaza URLs inválidas con un mensaje en español", () => {
    expect(() => leerEnv({ EXPO_PUBLIC_API_URL: "192.168.1.50:3001" }, android)).toThrow(
      "Configuración inválida en .env: EXPO_PUBLIC_API_URL debe ser una URL http(s) completa",
    );
    expect(() => leerEnv({ EXPO_PUBLIC_SOCKET_URL: "ftp://x.co" }, android)).toThrow(
      "EXPO_PUBLIC_SOCKET_URL",
    );
  });

  it("en las pruebas la API es http://api.test (jest.config.js)", () => {
    expect(env.apiUrl).toBe("http://api.test/api/v1");
  });
});
