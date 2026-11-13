import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { __reiniciarErroresGoogleMaps } from "@/lib/erroresGoogleMaps";
import { PLANTILLAS, semanaVacia, type Semana } from "@/lib/horarios";
import type { Ubicacion } from "@/lib/ubicacion";
import { EditorHorarioSemanal } from "./EditorHorarioSemanal";
import { UbicacionSede } from "./UbicacionSede";

// Google Maps simulado: el mapa es un botón que "toca" un punto, el pin otro que lo "arrastra"
// y Places devuelve una sugerencia fija.
const estadoApi = vi.hoisted(() => ({ valor: "LOADED" }));
vi.mock("@vis.gl/react-google-maps", () => ({
  APILoadingStatus: { FAILED: "FAILED", AUTH_FAILURE: "AUTH_FAILURE", LOADED: "LOADED" },
  APIProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useApiLoadingStatus: () => estadoApi.valor,
  useMap: () => ({ panTo: vi.fn(), setZoom: vi.fn() }),
  Map: ({ children, onClick }: { children: ReactNode; onClick: (e: unknown) => void }) => (
    <div>
      <button
        type="button"
        onClick={() => onClick({ detail: { latLng: { lat: 9.3011112, lng: -75.3922229 } } })}
      >
        tocar mapa
      </button>
      {children}
    </div>
  ),
  AdvancedMarker: ({ onDragEnd }: { onDragEnd: (e: unknown) => void }) => (
    <button type="button" onClick={() => onDragEnd({ latLng: { lat: () => 9.31, lng: () => -75.39 } })}>
      arrastrar pin
    </button>
  ),
  useMapsLibrary: () => ({
    AutocompleteSessionToken: class {},
    AutocompleteSuggestion: {
      fetchAutocompleteSuggestions: async () => ({
        suggestions: [
          {
            placePrediction: {
              placeId: "p1",
              text: { text: "Calle 23 # 18-45, Sincelejo" },
              mainText: { text: "Calle 23 # 18-45" },
              secondaryText: { text: "Sincelejo, Sucre" },
              toPlace: () => ({
                formattedAddress: "Cl. 23 #18-45, Sincelejo, Sucre",
                location: { lat: () => 9.3047212345, lng: () => -75.3977812345 },
                fetchFields: async () => undefined,
              }),
            },
          },
        ],
      }),
    },
  }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  __reiniciarErroresGoogleMaps();
  estadoApi.valor = "LOADED";
});

function EditorControlado({
  inicial = semanaVacia(),
  errores,
}: {
  inicial?: Semana;
  errores?: Record<string, string>;
}) {
  const [semana, setSemana] = useState(inicial);
  return (
    <TooltipProvider>
      <EditorHorarioSemanal value={semana} onChange={setSemana} errores={errores} />
      <output data-testid="semana">{JSON.stringify(semana)}</output>
    </TooltipProvider>
  );
}

const semanaActual = (): Semana => JSON.parse(screen.getByTestId("semana").textContent!) as Semana;

describe("EditorHorarioSemanal", () => {
  it("aplica una plantilla y la marca como activa", async () => {
    render(<EditorControlado />);
    expect(screen.getAllByText("Cerrado")).toHaveLength(7);
    await userEvent.setup().click(screen.getByRole("button", { name: "L–V 8–12 y 14–18" }));
    expect(screen.getByRole("button", { name: "L–V 8–12 y 14–18" })).toHaveAttribute("aria-pressed", "true");
    expect(semanaActual()[1]).toHaveLength(2);
    expect(screen.getAllByText("Cerrado")).toHaveLength(2);
  });

  it("agrega, edita y quita rangos (horario partido)", async () => {
    render(<EditorControlado />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Agregar rango al lunes" }));
    await user.click(screen.getByRole("button", { name: "Agregar rango al lunes" }));
    expect(semanaActual()[1]).toEqual([
      { apertura: "08:00", cierre: "12:00" },
      { apertura: "13:00", cierre: "17:00" },
    ]);

    await user.click(screen.getByRole("button", { name: "Editar rango 13:00–17:00 del lunes" }));
    await user.selectOptions(screen.getByLabelText("Abre"), "14:00");
    await user.selectOptions(screen.getByLabelText("Cierra"), "18:00");
    expect(semanaActual()[1]![1]).toEqual({ apertura: "14:00", cierre: "18:00" });
    await user.click(screen.getByRole("button", { name: "Listo" }));

    await user.click(screen.getByRole("button", { name: "Quitar rango 08:00–12:00 del lunes" }));
    expect(semanaActual()[1]).toEqual([{ apertura: "14:00", cierre: "18:00" }]);
  });

  it("copia un día a lunes–viernes", async () => {
    const inicial = semanaVacia();
    inicial[1] = [{ apertura: "09:00", cierre: "17:00" }];
    render(<EditorControlado inicial={inicial} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Copiar el horario del lunes" }));
    await user.click(await screen.findByRole("menuitem", { name: "Copiar a lunes–viernes" }));
    expect(semanaActual().map((d) => d.length)).toEqual([0, 1, 1, 1, 1, 1, 0]);
  });

  it("muestra los errores de cada rango", () => {
    render(
      <EditorControlado inicial={PLANTILLAS[0]!.semana()} errores={{ "2-1": "Se cruza con 08:00–12:00" }} />,
    );
    expect(screen.getByRole("button", { name: "Editar rango 14:00–18:00 del martes" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText("Se cruza con 08:00–12:00")).toBeInTheDocument();
  });
});

function UbicacionControlada({ inicial }: { inicial: Ubicacion }) {
  const [valor, setValor] = useState(inicial);
  return (
    <>
      <UbicacionSede value={valor} onChange={setValor} />
      <output data-testid="ubicacion">{JSON.stringify(valor)}</output>
    </>
  );
}

const ubicacionActual = (): Ubicacion =>
  JSON.parse(screen.getByTestId("ubicacion").textContent!) as Ubicacion;
const sinPunto: Ubicacion = { direccion: "", latitud: null, longitud: null };

describe("UbicacionSede sin clave de Google", () => {
  it("pide latitud y longitud a mano y enlaza el punto a Google Maps", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
    render(<UbicacionControlada inicial={sinPunto} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Dirección *"), "Calle 23 # 18-45");
    await user.type(screen.getByLabelText("Latitud"), "9,30472");
    expect(ubicacionActual()).toEqual({ direccion: "Calle 23 # 18-45", latitud: 9.30472, longitud: null });
    expect(screen.queryByRole("link", { name: /Ver en Google Maps/ })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Longitud"), "-75.39778");
    expect(screen.getByRole("link", { name: /Ver en Google Maps/ })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=9.30472,-75.39778",
    );

    await user.clear(screen.getByLabelText("Latitud"));
    expect(ubicacionActual().latitud).toBeNull();
  });
});

describe("UbicacionSede con Google Maps", () => {
  it("busca la dirección y al elegirla llena la dirección y el punto", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "clave-de-prueba");
    render(<UbicacionControlada inicial={sinPunto} />);
    const user = userEvent.setup();
    await user.type(await screen.findByRole("combobox"), "Calle 23");
    await user.click(await screen.findByRole("option", { name: /Calle 23 # 18-45/ }));
    await waitFor(() =>
      expect(ubicacionActual()).toEqual({
        direccion: "Cl. 23 #18-45, Sincelejo, Sucre",
        latitud: 9.304721,
        longitud: -75.397781,
      }),
    );
    expect(screen.getByText(/9.304721, -75.397781 · Arrastra el pin/)).toBeInTheDocument();
  });

  it("tocar el mapa y arrastrar el pin cambian solo las coordenadas; se pueden quitar", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "clave-de-prueba");
    render(<UbicacionControlada inicial={{ direccion: "Cra 19", latitud: null, longitud: null }} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "tocar mapa" }));
    expect(ubicacionActual()).toEqual({ direccion: "Cra 19", latitud: 9.301111, longitud: -75.392223 });
    await user.click(screen.getByRole("button", { name: "arrastrar pin" }));
    expect(ubicacionActual()).toMatchObject({ latitud: 9.31, longitud: -75.39 });
    await user.click(screen.getByRole("button", { name: "Quitar ubicación" }));
    expect(ubicacionActual()).toEqual({ direccion: "Cra 19", latitud: null, longitud: null });
  });

  it("si Google no carga (clave inválida), pasa a coordenadas manuales con un aviso", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "clave-mala");
    estadoApi.valor = "AUTH_FAILURE";
    render(<UbicacionControlada inicial={sinPunto} />);
    expect(await screen.findByText(/No pudimos cargar el mapa/)).toBeInTheDocument();
    expect(screen.getByLabelText("Latitud")).toBeInTheDocument();
  });

  it("sin facturación en Google Cloud (solo lo dice la consola): coordenadas manuales con el motivo", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "clave-sin-facturacion");
    render(<UbicacionControlada inicial={sinPunto} />);
    expect(await screen.findByRole("combobox")).toBeInTheDocument();

    act(() =>
      console.error(
        "Google Maps JavaScript API error: BillingNotEnabledMapError\nhttps://developers.google.com/maps/documentation/javascript/error-messages#billing-not-enabled-map-error",
      ),
    );
    expect(await screen.findByText(/falta activar la facturación de Google Cloud/)).toBeInTheDocument();
    expect(screen.getByLabelText("Latitud")).toBeInTheDocument();

    // La API se carga una vez por página: otra ubicación que se monte después ya sabe del error.
    render(<UbicacionControlada inicial={sinPunto} />);
    expect(screen.getAllByText(/falta activar la facturación de Google Cloud/)).toHaveLength(2);
  });
});
