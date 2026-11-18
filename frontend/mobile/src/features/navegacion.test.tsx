import { fireEvent, screen } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import { volverOIr } from "@/lib/navegacion";

import AuthLayout from "../../app/(auth)/_layout";
import Bienvenida from "../../app/(auth)/bienvenida";
import Login from "../../app/(auth)/login";
import Registro from "../../app/(auth)/registro";
import TabsLayout from "../../app/(tabs)/_layout";
import Inicio from "../../app/(tabs)/index";
import Perfil from "../../app/(tabs)/perfil";
import RootLayout from "../../app/_layout";
import Estado from "../../app/dev/estado";

// Las rutas reales de la app (las pestañas que no se recorren aquí no hacen falta).
const RUTAS = {
  _layout: RootLayout,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/index": Inicio,
  "(tabs)/perfil": Perfil,
  "(auth)/_layout": AuthLayout,
  "(auth)/bienvenida": Bienvenida,
  "(auth)/login": Login,
  "(auth)/registro": Registro,
  "dev/estado": Estado,
};

let errores: string[] = [];
let espia: jest.SpyInstance;

beforeEach(() => {
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

// La flecha de ScreenHeader es el primer "Volver" de la pantalla.
const flechaVolver = () => screen.getAllByRole("button", { name: "Volver" })[0]!;

describe("Volver sin historial (enlace directo o recarga de Metro)", () => {
  it.each([
    ["/login", "/"],
    ["/registro", "/"],
    ["/bienvenida", "/perfil"],
    ["/dev/estado", "/perfil"],
  ])("en %s la flecha lleva a la ruta de respaldo %s", async (inicial, respaldo) => {
    await renderRouter(RUTAS, { initialUrl: inicial });
    expect(screen).toHavePathname(inicial);

    await fireEvent.press(flechaVolver());

    expect(screen).toHavePathname(respaldo);
  });

  it("el botón Volver de la pantalla temporal también usa el respaldo", async () => {
    await renderRouter(RUTAS, { initialUrl: "/login" });
    const botones = screen.getAllByRole("button", { name: "Volver" });
    await fireEvent.press(botones[botones.length - 1]!);
    expect(screen).toHavePathname("/");
  });
});

describe("Volver con historial", () => {
  it("Perfil → Bienvenida → Iniciar sesión, y de vuelta paso a paso", async () => {
    await renderRouter(RUTAS, { initialUrl: "/perfil" });

    await fireEvent.press(screen.getByRole("button", { name: "Ver la bienvenida" }));
    expect(screen).toHavePathname("/bienvenida");
    await fireEvent.press(screen.getByRole("button", { name: "Ya tengo cuenta" }));
    expect(screen).toHavePathname("/login");

    await fireEvent.press(flechaVolver());
    expect(screen).toHavePathname("/bienvenida");
    await fireEvent.press(flechaVolver());
    expect(screen).toHavePathname("/perfil");
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
