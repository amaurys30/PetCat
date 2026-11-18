import { fireEvent, screen } from "@testing-library/react-native";
import { http } from "msw";

import { refreshStorage } from "@/api/refreshStorage";
import { volverOIr } from "@/lib/navegacion";

import { reiniciarSesion, renderApp } from "../../test/app";
import { API, ok, perfilDemo, sesionDemo } from "../../test/msw/handlers";
import { server } from "../../test/msw/server";

let errores: string[] = [];
let espia: jest.SpyInstance;

beforeEach(async () => {
  await reiniciarSesion();
  errores = [];
  espia = jest.spyOn(console, "error").mockImplementation((...args) => {
    errores.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  espia.mockRestore();
  // "The action 'GO_BACK' was not handled by any navigator" sale por console.error.
  expect(errores.filter((e) => e.includes("GO_BACK"))).toEqual([]);
});

async function conSesion() {
  await refreshStorage.guardar("refresh-0");
  server.use(
    http.post(`${API}/auth/refresh-token`, () => ok(sesionDemo(1))),
    http.get(`${API}/auth/me`, () => ok(perfilDemo())),
  );
}

// La flecha de ScreenHeader es el primer "Volver" de la pantalla.
const flechaVolver = () => screen.getAllByRole("button", { name: "Volver" })[0]!;

describe("Volver sin historial (enlace directo o recarga de Metro)", () => {
  it.each([
    ["/registro", "/bienvenida"],
    ["/recuperar", "/login"],
    ["/recuperar-codigo?email=sofia%40petcat.test", "/recuperar"],
  ])("sin sesión, en %s la flecha lleva a %s", async (inicial, respaldo) => {
    await renderApp(inicial);
    await fireEvent.press(await screen.findByRole("button", { name: "Volver" }));
    expect(screen).toHavePathname(respaldo);
  });

  it("con sesión, el diagnóstico vuelve a Perfil", async () => {
    await conSesion();
    await renderApp("/dev/estado");
    await screen.findByText("Conectada");
    await fireEvent.press(flechaVolver());
    expect(screen).toHavePathname("/perfil");
  });

  it("la política vuelve al inicio, que sin sesión es la Bienvenida", async () => {
    await renderApp("/politica");
    await fireEvent.press(await screen.findByRole("button", { name: "Volver" }));
    expect(await screen.findByTestId("carrusel-bienvenida")).toBeOnTheScreen();
  });
});

describe("Volver con historial", () => {
  it("Bienvenida → Crear cuenta → Volver regresa a la Bienvenida", async () => {
    await renderApp();
    await fireEvent.press(await screen.findByRole("button", { name: "Crear mi cuenta" }));
    expect(screen).toHavePathname("/registro");
    await fireEvent.press(flechaVolver());
    expect(screen).toHavePathname("/bienvenida");
  });
});

describe("rutas protegidas", () => {
  it("sin sesión, las pestañas y el diagnóstico llevan a la Bienvenida", async () => {
    await renderApp("/perfil");
    expect(await screen.findByTestId("carrusel-bienvenida")).toBeOnTheScreen();
  });

  it("con sesión, la Bienvenida y el login llevan a las pestañas", async () => {
    await conSesion();
    await renderApp("/login");
    expect(await screen.findByRole("tab", { name: "Inicio" })).toBeSelected();
  });
});

describe("volverOIr", () => {
  const router = (puede: boolean) => ({ canGoBack: () => puede, back: jest.fn(), replace: jest.fn() });

  it("vuelve si hay historial", () => {
    const r = router(true);
    volverOIr(r, "/perfil");
    expect(r.back).toHaveBeenCalled();
    expect(r.replace).not.toHaveBeenCalled();
  });

  it("sin historial reemplaza por el respaldo, Inicio por defecto", () => {
    const r = router(false);
    volverOIr(r);
    expect(r.back).not.toHaveBeenCalled();
    expect(r.replace).toHaveBeenCalledWith("/");
  });
});
