import { describe, expect, it } from "vitest";
import { origenSocket, urlApi } from "./origen";

describe("urlApi", () => {
  it("en desarrollo usa la ruta relativa del proxy aunque VITE_API_URL sea absoluta", () => {
    expect(urlApi({ DEV: true, VITE_API_URL: "http://localhost:3001/api/v1" })).toBe("/api/v1");
    expect(urlApi({ DEV: true })).toBe("/api/v1");
  });

  it("en el build usa VITE_API_URL y, si falta, la ruta relativa", () => {
    expect(urlApi({ DEV: false, VITE_API_URL: "https://api.petcat.co/api/v1" })).toBe("https://api.petcat.co/api/v1");
    expect(urlApi({ DEV: false, VITE_API_URL: "" })).toBe("/api/v1");
    expect(urlApi({ DEV: false })).toBe("/api/v1");
  });
});

describe("origenSocket", () => {
  it("en desarrollo se conecta al mismo origen (proxy) aunque VITE_SOCKET_URL tenga valor", () => {
    expect(origenSocket({ DEV: true, VITE_SOCKET_URL: "http://localhost:3001" })).toBeUndefined();
  });

  it("en el build usa VITE_SOCKET_URL y, vacía, el mismo origen", () => {
    expect(origenSocket({ DEV: false, VITE_SOCKET_URL: "https://api.petcat.co" })).toBe("https://api.petcat.co");
    expect(origenSocket({ DEV: false, VITE_SOCKET_URL: "" })).toBeUndefined();
  });
});
