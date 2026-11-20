import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { http, HttpResponse } from "msw";
import { AccessibilityInfo } from "react-native";

import { refreshStorage } from "@/api/refreshStorage";
import { guardarSesionSinConexion, suscribirCache } from "@/lib/cachePersistente";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { useMascotaSeleccionada } from "@/store/mascotaSeleccionada";

import { reiniciarSesion, renderApp } from "../../../test/app";
import {
  API,
  fallo,
  mascotaDemo,
  ok,
  perfilDemo,
  registroDemo as registro,
  sesionDemo,
  vacunaDemo as vacuna,
} from "../../../test/msw/handlers";
import { server } from "../../../test/msw/server";

let anuncios: string[];

beforeEach(async () => {
  await reiniciarSesion();
  anuncios = [];
  jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation((m) => void anuncios.push(m));
  jest.mocked(AsyncStorage.setItem).mockClear();
});

afterEach(() => jest.restoreAllMocks());

const luna = mascotaDemo({ microchip: "985141000123456" });
const milo = mascotaDemo({
  id_mascota: 2,
  nombre: "Milo",
  especie: "gato",
  raza: null,
  sexo: "macho",
  codigo_pasaporte: "PC-ABCD-EFGH",
});

const vacunasLuna = [
  vacuna({ id_vacuna: 1, nombre_vacuna: "Rabia", fecha_proxima: "2099-12-12" }),
  vacuna({ id_vacuna: 2, nombre_vacuna: "Múltiple", estado: "proximo", fecha_proxima: "2099-01-10" }),
  vacuna({
    id_vacuna: 3,
    nombre_vacuna: "Bordetella",
    estado: "vencido",
    fecha_proxima: "2026-11-01",
    registrada_por: "dueno",
    negocio: null,
  }),
  vacuna({ id_vacuna: 4, nombre_vacuna: "Rabia", estado: "no_aplica", fecha_aplicacion: "2024-12-12" }),
];

const pagina = (data: unknown[], { page = 1, hasNext = false, total = data.length } = {}) =>
  HttpResponse.json({
    success: true,
    message: "OK",
    data,
    meta: { total, page, limit: 20, totalPages: 1, hasNext },
  });

/** Sesión que el arranque renueva, las mascotas, sus vacunas y su historial. */
function conSesion({
  mascotas = [luna, milo] as unknown[],
  vacunas = { 1: vacunasLuna } as Record<number, unknown[]>,
  historial = {} as Record<number, unknown[]>,
} = {}) {
  void refreshStorage.guardar("refresh-0");
  server.use(
    http.post(`${API}/auth/refresh-token`, () => ok(sesionDemo(1))),
    http.get(`${API}/auth/me`, () => ok(perfilDemo())),
    http.get(`${API}/mascotas`, () => ok(mascotas)),
    http.get(`${API}/mascotas/:id`, ({ params }) => {
      const m = (mascotas as { id_mascota: number }[]).find((x) => x.id_mascota === Number(params.id));
      return m ? ok(m) : fallo(404, "Mascota no encontrada");
    }),
    http.get(`${API}/mascotas/:id/vacunas`, ({ params }) => ok(vacunas[Number(params.id)] ?? [])),
    http.get(`${API}/mascotas/:id/historial`, ({ params, request }) => {
      const tipo = new URL(request.url).searchParams.get("tipo");
      const todos = (historial[Number(params.id)] ?? []) as { tipo: string }[];
      return pagina(tipo ? todos.filter((r) => tipo.split(",").includes(r.tipo)) : todos);
    }),
  );
}

describe("M7 · Pasaporte PetCat", () => {
  it("abre con la mascota elegida en Inicio; con el lector cambia de mascota y actualiza la selección", async () => {
    useMascotaSeleccionada.setState({ id_usuario: 7, id_mascota: 2 });
    conSesion();
    await renderApp("/carnet");

    const pila = await screen.findByTestId("pila-pasaportes");
    await waitFor(() =>
      expect(pila.props.accessibilityLabel).toMatch(
        /^Pasaporte PetCat de Milo\. Número P C, A B C D, E F G H\./,
      ),
    );
    expect(pila).toHaveAccessibilityValue({ text: "Mascota 2 de 2" });
    expect(pila.props.accessibilityRole).toBe("adjustable");

    await fireEvent(pila, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });

    await waitFor(() =>
      expect(screen.getByTestId("pila-pasaportes").props.accessibilityLabel).toMatch(
        /^Pasaporte PetCat de Luna\./,
      ),
    );
    expect(screen.getByTestId("pila-pasaportes")).toHaveAccessibilityValue({ text: "Mascota 1 de 2" });
    expect(anuncios).toContain("Luna");
    expect(useMascotaSeleccionada.getState().id_mascota).toBe(1);
  });

  it("la tarjeta, el anillo y cada sello se leen completos como texto", async () => {
    conSesion({
      mascotas: [luna],
      historial: {
        1: [
          registro({
            id_historial: 9,
            tipo: "desparasitacion",
            fecha: "2026-10-01",
            proximo_control: "2099-01-01",
          }),
        ],
      },
    });
    await renderApp("/carnet");

    expect(
      await screen.findByLabelText(
        "Pasaporte PetCat de Luna. Número P C, 7 K Q 4, M 9 X R. Perro, Labrador. Nació el mié 10 may 2023. " +
          "Microchip 985 141 000 123 456. Vacunas: 2 de 3 al día.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByTestId("anillo-vacunas").props.accessibilityLabel).toBe(
      "2 de 3 vacunas al día. Bordetella venció el 1 nov",
    );
    expect(screen.getByTestId("sello-vacuna-1").props.accessibilityLabel).toMatch(
      /^Rabia\. Aplicada el .*\. Próxima dosis el .*\. Registrada por Clínica Patitas\.$/,
    );
    expect(screen.getByTestId("sello-vacuna-2").props.accessibilityLabel).toMatch(/^Múltiple\. Próxima\./);
    expect(screen.getByTestId("sello-vacuna-3").props.accessibilityLabel).toMatch(
      /^Bordetella\. Vencida\..*Registrada por ti\.$/,
    );
    // La dosis anterior de la rabia no tiene sello propio.
    expect(screen.queryByTestId("sello-vacuna-4")).toBeNull();
    expect(await screen.findByTestId("sello-desparasitacion-9")).toBeOnTheScreen();
  });

  it("sin vacunas: lo dice; Compartir y PDF visibles pero deshabilitados (Próximamente)", async () => {
    conSesion({ mascotas: [luna], vacunas: {} });
    await renderApp("/carnet");

    expect(await screen.findByText("Aún no hay vacunas registradas")).toBeOnTheScreen();
    expect(screen.queryByTestId("anillo-vacunas")).toBeNull();
    expect(screen.getByRole("button", { name: "Compartir con QR. Próximamente" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descargar PDF. Próximamente" })).toBeDisabled();
  });

  it("«En memoria»: tarjeta con la fecha, sin anillo, sellos como recuerdo", async () => {
    conSesion({ mascotas: [mascotaDemo({ fallecido: true, fecha_fallecimiento: "2026-11-10" })] });
    await renderApp("/carnet");

    expect(
      await screen.findByLabelText(/^Pasaporte PetCat de Luna\..*En memoria, desde el mar 10 nov 2026\.$/),
    ).toBeOnTheScreen();
    expect(await screen.findByText(/sus vacunas quedan aquí como recuerdo/)).toBeOnTheScreen();
    expect(screen.queryByTestId("anillo-vacunas")).toBeNull();
    expect(screen.getByTestId("sello-vacuna-3").props.accessibilityLabel).toMatch(
      /^Bordetella\. Aplicada el/,
    );
  });

  it("sin mascotas: invita a agregar la primera", async () => {
    conSesion({ mascotas: [] });
    await renderApp("/carnet");
    await fireEvent.press(await screen.findByRole("button", { name: "Agregar mascota" }));
    expect(screen).toHavePathname("/mascotas/nueva");
  });

  it("efecto: el sensor solo con la pestaña visible; con Reducir movimiento, brillo fijo", async () => {
    conSesion({ mascotas: [luna] });
    await renderApp("/carnet");
    expect(await screen.findByTestId("pasaporte-efecto-activo")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("tab", { name: "Inicio" }));
    await waitFor(() => expect(screen.queryByTestId("pasaporte-efecto-activo")).toBeNull());

    await fireEvent.press(screen.getByRole("tab", { name: "Carnet de mis mascotas" }));
    expect(await screen.findByTestId("pasaporte-efecto-activo")).toBeOnTheScreen();
  });

  it("con Reducir movimiento no se monta el sensor", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    conSesion({ mascotas: [luna] });
    await renderApp("/carnet");
    expect(await screen.findByTestId("pasaporte-efecto-fijo")).toBeOnTheScreen();
    expect(screen.queryByTestId("pasaporte-efecto-activo")).toBeNull();
  });

  it("sin red: el Pasaporte se ve con las vacunas guardadas", async () => {
    await guardarSesionSinConexion(7, "Sofía");
    const dejar = suscribirCache(7);
    queryClient.setQueryData(queryKeys.mascotas.lista(), [luna]);
    queryClient.setQueryData(queryKeys.mascotas.vacunas(1), vacunasLuna);
    queryClient.setQueryData(queryKeys.mascotas.desparasitacion(1), null);
    await waitFor(() =>
      expect(
        jest
          .mocked(AsyncStorage.setItem)
          .mock.calls.filter(([k]) => k === "petcat.cache")
          .at(-1)?.[1],
      ).toContain("Bordetella"),
    );
    dejar();
    queryClient.clear();

    await refreshStorage.guardar("refresh-0");
    server.use(
      http.post(`${API}/auth/refresh-token`, () => HttpResponse.error()),
      http.get(`${API}/mascotas`, () => HttpResponse.error()),
      http.get(`${API}/mascotas/:id/vacunas`, () => HttpResponse.error()),
      http.get(`${API}/mascotas/:id/historial`, () => HttpResponse.error()),
    );
    await renderApp("/carnet");

    expect(await screen.findByText(/Sin conexión · datos de/)).toBeOnTheScreen();
    expect(screen.getByTestId("anillo-vacunas")).toBeOnTheScreen();
    expect(screen.getByTestId("sello-vacuna-3")).toBeOnTheScreen();
  });
});

describe("M8 · Línea de vida", () => {
  const conProximo = mascotaDemo({
    resumen: {
      estado_vacunas: "vencido",
      vacunas: { vigentes: 3, al_dia: 1, proximas: 1, vencidas: 1 },
      proximos_eventos: [
        {
          tipo: "vacuna",
          titulo: "Bordetella",
          fecha: "2026-11-01",
          dias: -19,
          id_vacuna: 3,
          id_historial: null,
          negocio: null,
        },
      ],
      proxima_cita: null,
    },
  });
  const historialLuna = [
    registro({ id_historial: 60, fecha: "2026-10-14", diagnostico: "Todo normal", peso_registro: 28.4 }),
    registro({
      id_historial: 55,
      fecha: "2026-10-01",
      tipo: "desparasitacion",
      medicamentos_prescritos: "Drontal Plus",
    }),
  ];

  it("Todo: Próximo arriba, del más reciente al más antiguo, con años; al tocar, el detalle", async () => {
    conSesion({ mascotas: [conProximo], historial: { 1: historialLuna } });
    await renderApp("/mascotas/1/linea-vida");

    expect(
      await screen.findByLabelText("Vacuna: Bordetella. Vencida. Venció hace 19 días, dom 1 nov 2026."),
    ).toBeOnTheScreen();
    // Registros en orden: su etiqueta empieza con la fecha ("mié 14 oct 2026. Consulta general. …").
    await screen.findByText("Consulta general");
    const registros = screen
      .getAllByLabelText(/^\S+ \d+ \S+ \d{4}\. /)
      .map((r) => String(r.props.accessibilityLabel).split(". ")[1]);
    expect(registros).toEqual([
      "Consulta general",
      "Desparasitación",
      "Rabia",
      "Múltiple",
      "Bordetella",
      "Rabia",
    ]);
    expect(screen.getAllByRole("header", { name: /^20\d\d$/ }).map((h) => h.props.children)).toEqual([
      "2026",
      "2025",
      "2024",
    ]);

    const consulta = screen.getByRole("button", { name: /^mié 14 oct 2026\. Consulta general\. Atendida\./ });
    expect(screen.queryByText("Todo normal")).toBeNull();
    await fireEvent.press(consulta);
    expect(screen.getByText("Todo normal")).toBeOnTheScreen();
    expect(consulta).toBeExpanded();
  });

  it("filtros: Vacunas no pide el historial; Consultas pide sus 9 tipos", async () => {
    const pedidos: (string | null)[] = [];
    conSesion({ mascotas: [luna], historial: { 1: historialLuna } });
    server.events.on("request:start", ({ request }) => {
      if (request.url.includes("/historial")) pedidos.push(new URL(request.url).searchParams.get("tipo"));
    });
    await renderApp("/mascotas/1/linea-vida");
    await screen.findByText("Consulta general");

    await fireEvent.press(screen.getByRole("button", { name: "Vacunas" }));
    await waitFor(() => expect(screen.queryByText("Consulta general")).toBeNull());
    expect(screen.getAllByText("Rabia").length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByRole("button", { name: "Consultas" }));
    expect(await screen.findByText("Consulta general")).toBeOnTheScreen();
    expect(screen.queryByText("Rabia")).toBeNull();
    // "desparasitacion": la última, guardada para ver sin red.
    expect(pedidos.filter((t) => t !== "desparasitacion")).toEqual([
      null,
      "consulta_general,control,cirugia,examen_laboratorio,radiografia,ecografia,hospitalizacion,urgencia,otro",
    ]);
    server.events.removeAllListeners();
  });

  it("paginación: Cargar más trae la página siguiente y las vacunas más antiguas aparecen en su lugar", async () => {
    conSesion({ mascotas: [luna] });
    server.use(
      http.get(`${API}/mascotas/:id/historial`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        return page === 1
          ? pagina([registro({ id_historial: 60, fecha: "2026-10-14" })], {
              page: 1,
              hasNext: true,
              total: 2,
            })
          : pagina([registro({ id_historial: 30, fecha: "2023-05-01", tipo: "control" })], {
              page: 2,
              total: 2,
            });
      }),
    );
    await renderApp("/mascotas/1/linea-vida");

    expect(await screen.findByText("Consulta general")).toBeOnTheScreen();
    // Las vacunas de 2025 son más antiguas que lo cargado: todavía no se muestran.
    expect(screen.queryByText("Múltiple")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Cargar más" }));
    expect(await screen.findByText("Control")).toBeOnTheScreen();
    expect(screen.getByText("Múltiple")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull();
  });

  it("si el historial no carga (sin red): aviso, vacunas y la última desparasitación guardada", async () => {
    conSesion({ mascotas: [luna] });
    server.use(
      http.get(`${API}/mascotas/:id/historial`, ({ request }) =>
        new URL(request.url).searchParams.get("limit") === "1"
          ? pagina([registro({ id_historial: 55, fecha: "2026-10-01", tipo: "desparasitacion" })])
          : HttpResponse.error(),
      ),
    );
    await renderApp("/mascotas/1/linea-vida");
    // Los fallos de red se reintentan 2 veces (1 s y 2 s, timers falsos): se adelanta el reloj
    // en lugar de esperar a que waitFor lo haga de a 50 ms.
    await act(() => jest.advanceTimersByTimeAsync(4_000));

    expect(await screen.findByText(/las consultas necesitan conexión/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^jue 1 oct 2026\. Desparasitación\. Aplicada\./)).toBeOnTheScreen();
    expect(screen.getAllByLabelText(/\. Rabia\. Aplicada\./).length).toBeGreaterThan(0);
  });

  it("desde la ficha se abre la línea de vida", async () => {
    conSesion({ mascotas: [luna] });
    await renderApp("/mascotas/1");
    await fireEvent.press(await screen.findByRole("button", { name: "Ver la línea de vida de Luna" }));
    expect(screen).toHavePathname("/mascotas/1/linea-vida");
  });
});
