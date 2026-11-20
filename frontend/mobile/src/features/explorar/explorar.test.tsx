import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Location from "expo-location";
import { http, HttpResponse } from "msw";
import { AccessibilityInfo, Alert, type AlertButton, Linking } from "react-native";

import { refreshStorage } from "@/api/refreshStorage";

import { reiniciarSesion, renderApp } from "../../../test/app";
import {
  API,
  fallo,
  negocioBusquedaDemo,
  negocioPublicoDemo,
  ok,
  perfilDemo,
  sesionDemo,
} from "../../../test/msw/handlers";
import { server } from "../../../test/msw/server";
import { inyectados } from "../../../test/webviewMock";

let anuncios: string[];
let busquedas: URLSearchParams[];

const vet = negocioBusquedaDemo();
const pelu = negocioBusquedaDemo(
  {
    id_negocio: 2,
    nombre: "Peluquería Huellitas",
    tipo: "peluqueria_canina",
    calificacion_promedio: 4.6,
    total_resenas: 20,
    distancia_km: 0.4,
  },
  {
    id_sucursal: 20,
    latitud: 9.3152,
    longitud: -75.3885,
    abierto_ahora: false,
    cierra_a: null,
    abre_hoy_a: "14:00",
  },
);

beforeEach(async () => {
  await reiniciarSesion();
  anuncios = [];
  busquedas = [];
  inyectados.length = 0;
  jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation((m) => void anuncios.push(m));
  jest
    .mocked(Location.getForegroundPermissionsAsync)
    .mockResolvedValue({ status: "undetermined", granted: false, canAskAgain: true } as never);
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ status: "granted", granted: true, canAskAgain: true } as never);
});

afterEach(() => jest.restoreAllMocks());

function conSesion(negocios: unknown[] = [vet, pelu]) {
  void refreshStorage.guardar("refresh-0");
  server.use(
    http.post(`${API}/auth/refresh-token`, () => ok(sesionDemo(1))),
    http.get(`${API}/auth/me`, () => ok(perfilDemo())),
    // El perfil que abre Agendar.
    http.get(`${API}/negocios/:id`, ({ params }) =>
      ok(negocioPublicoDemo({ id_negocio: Number(params.id) })),
    ),
    http.get(`${API}/negocios`, ({ request }) => {
      busquedas.push(new URL(request.url).searchParams);
      return HttpResponse.json({
        success: true,
        message: "OK",
        data: negocios,
        meta: { total: negocios.length, page: 1, limit: 100, totalPages: 1, hasNext: false },
      });
    }),
  );
}

const ultima = () => busquedas.at(-1)!;
// El WebView está oculto al lector a propósito (la alternativa es Ver lista): se incluye en la consulta.
const OCULTOS = { includeHiddenElements: true };
const mapa = () => screen.getByTestId("mapa-webview", OCULTOS);
/** Lo que el mapa (Leaflet en el WebView) le dice a la app. */
const delMapa = (mensaje: object) =>
  fireEvent(mapa(), "message", { nativeEvent: { data: JSON.stringify(mensaje) } });
/** Lo que la app le mandó al mapa. */
const alMapa = () =>
  inyectados.map(
    (codigo) =>
      JSON.parse(/recibir\((.*)\); true;$/.exec(codigo)![1]!) as { tipo: string; [k: string]: unknown },
  );

async function sinUbicacion() {
  await fireEvent.press(await screen.findByRole("button", { name: "Ahora no" }));
}

describe("M10 · Explorar", () => {
  it("explica la ubicación antes de pedirla; con ella busca alrededor del teléfono y muestra distancias", async () => {
    conSesion();
    await renderApp("/explorar");

    expect(await screen.findByText("Ver lo que está cerca")).toBeOnTheScreen();
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Usar mi ubicación" }));

    await waitFor(() => expect(ultima().get("lat")).toBe("9.315"));
    expect(ultima().get("lng")).toBe("-75.389");
    await fireEvent.press(screen.getByRole("button", { name: "Ver lista" }));
    expect(
      await screen.findByLabelText(
        "Clínica Vet Sabanas, Veterinaria. 4,9 estrellas, 128 reseñas. A 1,2 km. Abierto hasta 7:00 p. m.",
      ),
    ).toBeOnTheScreen();
  });

  it("sin la ubicación: centra en Sincelejo, sin distancias, y lo dice", async () => {
    conSesion();
    await renderApp("/explorar");
    await sinUbicacion();

    await waitFor(() => expect(ultima().get("lat")).toBe("9.305"));
    expect(ultima().get("lng")).toBe("-75.398");
    expect(screen.getByRole("button", { name: "Mostrando Sincelejo. Usar mi ubicación" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Ver lista" }));
    expect(
      await screen.findByLabelText(
        "Clínica Vet Sabanas, Veterinaria. 4,9 estrellas, 128 reseñas. Abierto hasta 7:00 p. m.",
      ),
    ).toBeOnTheScreen();
  });

  it("mapa: recibe los pines; al tocar uno, su tarjeta con Agendar y Cómo llegar", async () => {
    conSesion();
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    const alerta = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, botones?: AlertButton[]) => {
      botones?.find((b) => b.text === "Google Maps")?.onPress?.();
    });
    await renderApp("/explorar");
    await sinUbicacion();
    await waitFor(() => expect(busquedas.length).toBeGreaterThan(0));

    await delMapa({ tipo: "listo" });
    await waitFor(() => expect(alMapa().some((m) => m.tipo === "pines")).toBe(true));
    const pines = alMapa()
      .filter((m) => m.tipo === "pines")
      .at(-1)!.pines;
    expect(pines).toEqual([
      { id: 1, lat: 9.3047, lng: -75.3978, categoria: "veterinaria", etiqueta: "4,9" },
      { id: 2, lat: 9.3152, lng: -75.3885, categoria: "peluqueria", etiqueta: "4,6" },
    ]);
    expect(
      screen.getByLabelText(
        "Mapa con 2 negocios. Para recorrerlos con el lector de pantalla, usa Ver lista.",
      ),
    ).toBeOnTheScreen();

    await delMapa({ tipo: "pin", id: 2 });
    expect(await screen.findByText("Peluquería Huellitas")).toBeOnTheScreen();
    expect(screen.getByText("Cerrado · abre a las 2:00 p. m.")).toBeOnTheScreen();
    expect(anuncios).toContain(
      "Peluquería Huellitas, Peluquería canina. 4,6 estrellas, 20 reseñas. Cerrado · abre a las 2:00 p. m.",
    );
    expect(alMapa().at(-1)).toEqual({ tipo: "seleccionar", id: 2 });

    await fireEvent.press(screen.getByRole("button", { name: "Cómo llegar a Peluquería Huellitas" }));
    expect(alerta).toHaveBeenCalledWith(
      "Cómo llegar a Peluquería Huellitas",
      "¿Con qué app?",
      expect.any(Array),
    );
    expect(Linking.openURL).toHaveBeenCalledWith(
      "https://www.google.com/maps/dir/?api=1&destination=9.3152%2C-75.3885",
    );

    await fireEvent.press(screen.getByRole("button", { name: "Agendar en Peluquería Huellitas" }));
    expect(screen).toHavePathname("/negocios/2/agendar");
  });

  it("filtros y búsqueda van a la API", async () => {
    conSesion();
    await renderApp("/explorar");
    await sinUbicacion();
    await waitFor(() => expect(busquedas.length).toBeGreaterThan(0));

    await fireEvent.press(screen.getByRole("button", { name: "Abierto ahora" }));
    await fireEvent.press(screen.getByRole("button", { name: "Veterinarias" }));
    // Con los dos filtros (el estado intermedio, solo con uno, también se pide: no importa el orden).
    const conAmbos = (b: URLSearchParams) =>
      b.get("tipo") === "veterinaria,clinica" && b.get("abierto_ahora") === "true";
    await waitFor(() => expect(busquedas.some(conAmbos)).toBe(true));
    expect(screen.getByRole("button", { name: "Veterinarias" })).toBeSelected();

    await fireEvent.changeText(screen.getByLabelText("Buscar"), "patitas");
    await act(() => jest.advanceTimersByTimeAsync(500));
    await waitFor(() => expect(busquedas.some((b) => b.get("q") === "patitas" && conAmbos(b))).toBe(true));
  });

  it("el WebView no navega a otros sitios: los enlaces (atribución) se abren fuera", async () => {
    conSesion();
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    await renderApp("/explorar");
    await sinUbicacion();
    const decidir = mapa().props.onShouldStartLoadWithRequest as (p: { url: string }) => boolean;

    expect(decidir({ url: "about:blank" })).toBe(true);
    expect(decidir({ url: "https://www.openstreetmap.org/copyright" })).toBe(false);
    expect(Linking.openURL).toHaveBeenCalledWith("https://www.openstreetmap.org/copyright");
    // Las teselas son imágenes, no navegación: la CSP del HTML permite su origen.
    expect(mapa().props.source.html).toContain("img-src https://tile.openstreetmap.org data:");
  });

  it("si las teselas no cargan, pasa a la lista con un aviso y deja reintentar el mapa", async () => {
    conSesion();
    await renderApp("/explorar");
    await sinUbicacion();
    await delMapa({ tipo: "listo" });
    await delMapa({ tipo: "teselas", estado: "error" });

    expect(
      await screen.findByText("El mapa no pudo cargar sus imágenes. Te mostramos la lista."),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Clínica Vet Sabanas, Veterinaria\./)).toBeOnTheScreen();
    expect(screen.queryByTestId("mapa-webview", OCULTOS)).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Reintentar mapa" }));
    expect(await screen.findByTestId("mapa-webview", OCULTOS)).toBeOnTheScreen();
  });

  it("si el mapa no avisa que está listo en 10 s, pasa a la lista", async () => {
    conSesion();
    await renderApp("/explorar");
    await sinUbicacion();
    await act(() => jest.advanceTimersByTimeAsync(10_500));
    expect(await screen.findByText("No pudimos cargar el mapa. Te mostramos la lista.")).toBeOnTheScreen();
  });

  it("ubicación bloqueada: el botón ofrece abrir Ajustes", async () => {
    jest
      .mocked(Location.getForegroundPermissionsAsync)
      .mockResolvedValue({ status: "denied", granted: false, canAskAgain: false } as never);
    jest.spyOn(Linking, "openSettings").mockResolvedValue();
    jest.spyOn(Alert, "alert").mockImplementation((_t, _m, botones?: AlertButton[]) => {
      botones?.find((b) => b.text === "Abrir Ajustes")?.onPress?.();
    });
    conSesion();
    await renderApp("/explorar");

    await fireEvent.press(await screen.findByRole("button", { name: "Activar mi ubicación" }));
    expect(Linking.openSettings).toHaveBeenCalled();
    expect(screen.queryByText("Ver lo que está cerca")).toBeNull();
  });

  it("sin resultados: lo dice; si la búsqueda falla, Reintentar", async () => {
    conSesion([]);
    await renderApp("/explorar");
    await sinUbicacion();
    expect(await screen.findByText("No encontramos negocios")).toBeOnTheScreen();

    server.use(http.get(`${API}/negocios`, () => fallo(500, "Error")));
    await fireEvent.press(screen.getByRole("button", { name: "Peluquería" }));
    await act(() => jest.advanceTimersByTimeAsync(4_000));
    expect(await screen.findByRole("button", { name: "Intentar de nuevo" })).toBeOnTheScreen();
  });
});

describe("M11 · Perfil del negocio", () => {
  function conPerfil(negocio = negocioPublicoDemo()) {
    conSesion();
    server.use(
      http.get(`${API}/negocios/:id`, () => ok(negocio)),
      http.get(`${API}/negocios/:id/resenas`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        const resena = (id: number, autor: string) => ({
          id_resena: id,
          calificacion: 5,
          aspectos: { atencion: 5, precio: null, instalaciones: null, puntualidad: null },
          titulo: null,
          comentario: `Muy buena atención (${autor})`,
          fecha_creacion: "2026-10-20 18:40:00",
          fecha_edicion: null,
          editada_despues_de_respuesta: false,
          respuesta: id === 1 ? { texto: "¡Gracias!", fecha: "2026-10-21 09:00:00", editada: false } : null,
          autor,
          visita_verificada: "2026-10",
        });
        return HttpResponse.json({
          success: true,
          message: "OK",
          data: page === 1 ? [resena(1, "Sofía G.")] : [resena(2, "Luis P.")],
          meta: {
            total: 2,
            page,
            limit: 10,
            totalPages: 2,
            hasNext: page === 1,
            resumen: {
              calificacion_promedio: 5,
              total_resenas: 2,
              distribucion: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 2 },
            },
          },
        });
      }),
    );
  }

  it("servicios con precio (y oferta), verificado y Agendar (abajo y en cada servicio)", async () => {
    conPerfil();
    await renderApp("/negocios/1");

    expect(await screen.findByRole("header", { name: "Clínica Vet Sabanas" })).toBeOnTheScreen();
    expect(screen.getByText("Verificado por PetCat")).toBeOnTheScreen();
    expect(screen.getByLabelText("Consulta general. 30 min. $45.000")).toBeOnTheScreen();
    expect(screen.getByLabelText("Vacunación. 15 min. $38.000. En oferta, antes $40.000")).toBeOnTheScreen();
    expect(screen.getByLabelText("Desde $38.000")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Agendar Vacunación" }));
    expect(screen).toHavePathname("/negocios/1/agendar");
    expect(screen).toHaveSearchParams({ id: "1", servicio: "2" });
  });

  it("sin servicios reservables, Agendar queda deshabilitado", async () => {
    conPerfil();
    server.use(
      http.get(`${API}/negocios/:id`, () =>
        ok(
          negocioPublicoDemo({
            servicios: negocioPublicoDemo().servicios.map((s) => ({ ...s, reservable: false })),
          }),
        ),
      ),
    );
    await renderApp("/negocios/1");
    expect(await screen.findByRole("button", { name: "Sin reservas en línea" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Agendar Consulta general" })).toBeNull();
  });

  it("reseñas paginadas con la respuesta del negocio", async () => {
    conPerfil();
    await renderApp("/negocios/1");
    await fireEvent.press(await screen.findByRole("radio", { name: "Reseñas" }));

    expect(
      await screen.findByLabelText(/^Sofía G\., 5 de 5 estrellas, .*Respuesta del negocio: ¡Gracias!$/),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Cargar más" }));
    expect(await screen.findByLabelText(/^Luis P\., 5 de 5 estrellas/)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull();
  });

  it("información: horario de lunes a domingo, cómo llegar y contacto", async () => {
    conPerfil();
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    await renderApp("/negocios/1");
    await fireEvent.press(await screen.findByRole("radio", { name: "Información" }));

    expect(
      screen.getByLabelText("Lunes: 8:00 a. m. a 12:00 p. m. y 2:00 p. m. a 6:00 p. m."),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText("Domingo: Cerrado")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Cómo llegar a Principal" })).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole("button", { name: "Escribir por WhatsApp a Clínica Vet Sabanas" }),
    );
    expect(Linking.openURL).toHaveBeenCalledWith("https://wa.me/573001234567");
  });

  it("si el negocio no existe: error con Reintentar y Volver", async () => {
    conSesion();
    server.use(http.get(`${API}/negocios/:id`, () => fallo(404, "Negocio no encontrado")));
    await renderApp("/negocios/99");
    expect(await screen.findByRole("button", { name: "Intentar de nuevo" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Volver" })).toBeOnTheScreen();
  });
});
