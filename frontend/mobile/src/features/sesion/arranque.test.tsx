import NetInfo from "@react-native-community/netinfo";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { http, HttpResponse } from "msw";

import { refreshStorage } from "@/api/refreshStorage";
import { useSesion } from "@/store/sesion";

import { reiniciarSesion, renderApp } from "../../../test/app";
import { API, fallo, ok, perfilDemo, sesionDemo } from "../../../test/msw/handlers";
import { server } from "../../../test/msw/server";

beforeEach(reiniciarSesion);

describe("arranque de la app", () => {
  it("sin sesión guardada abre la Bienvenida", async () => {
    await renderApp();
    expect(await screen.findByTestId("carrusel-bienvenida")).toBeOnTheScreen();
    expect(screen).toHavePathname("/bienvenida");
    expect(useSesion.getState().estado).toBe("anonima");
  });

  it("con sesión guardada renueva en silencio y abre las pestañas", async () => {
    await refreshStorage.guardar("refresh-0");
    server.use(
      http.post(`${API}/auth/refresh-token`, () => ok(sesionDemo(1))),
      http.get(`${API}/auth/me`, () => ok(perfilDemo())),
    );

    await renderApp();

    expect(await screen.findByRole("tab", { name: "Inicio" })).toBeSelected();
    expect(screen).toHavePathname("/");
    expect(await refreshStorage.leer()).toBe("refresh-1");
    expect(useSesion.getState()).toMatchObject({ estado: "autenticada", accessToken: "access-1" });
  });

  it("si la API rechaza el refresh, borra la sesión y abre la Bienvenida", async () => {
    await refreshStorage.guardar("refresh-0");
    server.use(http.post(`${API}/auth/refresh-token`, () => fallo(401, "Refresh token inválido o expirado")));

    await renderApp();

    expect(await screen.findByTestId("carrusel-bienvenida")).toBeOnTheScreen();
    expect(await refreshStorage.leer()).toBeNull();
  });

  it("sin red: pantalla Sin conexión, conserva la sesión y Reintentar entra", async () => {
    await refreshStorage.guardar("refresh-0");
    server.use(http.post(`${API}/auth/refresh-token`, () => HttpResponse.error()));

    await renderApp();

    expect(await screen.findByRole("header", { name: "Sin conexión" })).toBeOnTheScreen();
    expect(await refreshStorage.leer()).toBe("refresh-0");

    server.use(
      http.post(`${API}/auth/refresh-token`, () => ok(sesionDemo(1))),
      http.get(`${API}/auth/me`, () => ok(perfilDemo())),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("tab", { name: "Inicio" })).toBeOnTheScreen();
  });

  it("sin red: reintenta solo cuando vuelve la conexión (no con el aviso inicial)", async () => {
    await refreshStorage.guardar("refresh-0");
    let intentos = 0;
    server.use(
      http.post(`${API}/auth/refresh-token`, () => {
        intentos++;
        return intentos === 1 ? HttpResponse.error() : ok(sesionDemo(1));
      }),
      http.get(`${API}/auth/me`, () => ok(perfilDemo())),
    );

    await renderApp();
    expect(await screen.findByRole("header", { name: "Sin conexión" })).toBeOnTheScreen();

    const listener = jest.mocked(NetInfo.addEventListener).mock.calls.at(-1)![0];
    // Aviso inicial (ya conectado: el problema era el servidor): no reintenta.
    await act(async () => listener({ isConnected: true, isInternetReachable: true } as never));
    expect(intentos).toBe(1);
    // Se cae y vuelve: reintenta.
    await act(async () => listener({ isConnected: false, isInternetReachable: false } as never));
    await act(async () => listener({ isConnected: true, isInternetReachable: true } as never));

    expect(await screen.findByRole("tab", { name: "Inicio" })).toBeOnTheScreen();
    expect(intentos).toBe(2);
  });

  it("con la política pendiente pide aceptarla antes de las pestañas", async () => {
    await refreshStorage.guardar("refresh-0");
    let aceptada = false;
    server.use(
      http.post(`${API}/auth/refresh-token`, () => ok(sesionDemo(1))),
      http.get(`${API}/auth/me`, () => ok(perfilDemo(true))),
      http.post(`${API}/auth/politica-datos/aceptar`, async ({ request }) => {
        expect(await request.json()).toEqual({ acepta_politica_datos: true });
        aceptada = true;
        return ok({
          id_autorizacion: 1,
          canal: "aceptacion",
          version_politica: "1.0",
          fecha_autorizacion: "",
        });
      }),
    );

    await renderApp();

    expect(
      await screen.findByRole("header", { name: "Actualizamos nuestra política de datos" }),
    ).toBeOnTheScreen();
    expect(screen).toHavePathname("/aceptar-politica");

    // Sin marcar la casilla no envía.
    await fireEvent.press(screen.getByRole("button", { name: "Aceptar y continuar" }));
    expect(screen.getByText("Marca la casilla para aceptar la política")).toBeOnTheScreen();
    expect(aceptada).toBe(false);

    await fireEvent.press(screen.getByRole("checkbox"));
    await fireEvent.press(screen.getByRole("button", { name: "Aceptar y continuar" }));

    expect(await screen.findByRole("tab", { name: "Inicio" })).toBeOnTheScreen();
    expect(aceptada).toBe(true);
  });
});
