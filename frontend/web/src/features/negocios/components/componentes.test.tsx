import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PLANTILLAS, semanaVacia, type Semana } from "@/lib/horarios";
import { capaMapa, type Ubicacion } from "@/lib/ubicacion";
import { EditorHorarioSemanal } from "./EditorHorarioSemanal";
import { UbicacionSede } from "./UbicacionSede";

// Leaflet simulado: el mapa es un botón que "toca" un punto, el pin otro que lo "arrastra" y
// la capa de mosaicos muestra su atribución y un botón que simula que no cargó ninguno.
const mapa = vi.hoisted(() => ({
  clic: undefined as undefined | ((e: unknown) => void),
  setView: vi.fn(),
  getZoom: () => 13,
  getBounds: () => ({ contains: () => true }),
}));
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: ReactNode }) => (
    <div>
      <button type="button" onClick={() => mapa.clic?.({ latlng: { lat: 9.3011112, lng: -75.3922229 } })}>
        tocar mapa
      </button>
      {children}
    </div>
  ),
  TileLayer: ({
    url,
    attribution,
    eventHandlers,
  }: {
    url: string;
    attribution: string;
    eventHandlers: { tileerror: () => void };
  }) => (
    <div data-testid="mosaicos" data-url={url}>
      <span dangerouslySetInnerHTML={{ __html: attribution }} />
      <button type="button" onClick={() => eventHandlers.tileerror()}>
        fallan los mosaicos
      </button>
    </div>
  ),
  Marker: ({ eventHandlers }: { eventHandlers: { dragend: (e: unknown) => void } }) => (
    <button
      type="button"
      onClick={() => eventHandlers.dragend({ target: { getLatLng: () => ({ lat: 9.31, lng: -75.39 }) } })}
    >
      arrastrar pin
    </button>
  ),
  useMapEvents: (manejadores: { click: (e: unknown) => void }) => {
    mapa.clic = manejadores.click;
  },
  useMap: () => mapa,
  ZoomControl: () => null,
}));

/** Geolocalización simulada del navegador (jsdom no la trae). */
const simularGeolocalizacion = (getCurrentPosition: Geolocation["getCurrentPosition"]) =>
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });

afterEach(() => {
  vi.unstubAllEnvs();
  mapa.setView.mockClear();
  Reflect.deleteProperty(navigator, "geolocation");
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

describe("UbicacionSede", () => {
  it("la dirección es texto; tocar el mapa y arrastrar el pin cambian solo las coordenadas; se pueden quitar", async () => {
    render(<UbicacionControlada inicial={sinPunto} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Dirección *"), "Cra 19 # 22-35");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "tocar mapa" }));
    expect(ubicacionActual()).toEqual({
      direccion: "Cra 19 # 22-35",
      latitud: 9.301111,
      longitud: -75.392223,
    });
    expect(screen.getByText(/9.301111, -75.392223 · Arrastra el pin/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "arrastrar pin" }));
    expect(ubicacionActual()).toMatchObject({ latitud: 9.31, longitud: -75.39 });
    await user.click(screen.getByRole("button", { name: "Quitar ubicación" }));
    expect(ubicacionActual()).toEqual({ direccion: "Cra 19 # 22-35", latitud: null, longitud: null });
  });

  it("usa los mosaicos de OpenStreetMap con su atribución visible", async () => {
    render(<UbicacionControlada inicial={sinPunto} />);
    expect(await screen.findByRole("link", { name: "OpenStreetMap" })).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/copyright",
    );
    expect(screen.getByTestId("mosaicos")).toHaveAttribute(
      "data-url",
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    );
  });

  it("con la ubicación actual del navegador marca el punto y lleva el mapa hasta él", async () => {
    simularGeolocalizacion((ok) =>
      ok({ coords: { latitude: 9.2911119, longitude: -75.4011119 } } as GeolocationPosition),
    );
    render(<UbicacionControlada inicial={{ direccion: "Cra 19", latitud: null, longitud: null }} />);
    await screen.findByRole("button", { name: "tocar mapa" });
    await userEvent.setup().click(screen.getByRole("button", { name: "Usar mi ubicación actual" }));
    expect(ubicacionActual()).toEqual({ direccion: "Cra 19", latitud: 9.291112, longitud: -75.401112 });
    await waitFor(() => expect(mapa.setView).toHaveBeenCalledWith([9.291112, -75.401112], 17));
  });

  it("si el navegador niega la ubicación, lo dice y no cambia el punto", async () => {
    simularGeolocalizacion((_ok, error) =>
      error?.({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError),
    );
    render(<UbicacionControlada inicial={sinPunto} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Usar mi ubicación actual" }));
    expect(screen.getByRole("alert")).toHaveTextContent("No diste permiso para usar tu ubicación");
    expect(ubicacionActual()).toEqual(sinPunto);
  });

  it("sin geolocalización en el navegador no ofrece la ubicación actual", () => {
    render(<UbicacionControlada inicial={sinPunto} />);
    expect(screen.queryByRole("button", { name: "Usar mi ubicación actual" })).not.toBeInTheDocument();
  });

  it("las coordenadas manuales quedan como respaldo y enlazan el punto a OpenStreetMap", async () => {
    render(<UbicacionControlada inicial={sinPunto} />);
    const user = userEvent.setup();
    expect(screen.queryByLabelText("Latitud")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Escribir coordenadas" }));
    expect(screen.getByRole("button", { name: "Escribir coordenadas" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await user.type(screen.getByLabelText("Latitud"), "9,30472");
    expect(ubicacionActual()).toEqual({ direccion: "", latitud: 9.30472, longitud: null });
    expect(screen.queryByRole("link", { name: /Ver en OpenStreetMap/ })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Longitud"), "-75.39778");
    expect(screen.getByRole("link", { name: /Ver en OpenStreetMap/ })).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/?mlat=9.30472&mlon=-75.39778#map=17/9.30472/-75.39778",
    );

    // Lo que marca el mapa se ve en los campos.
    await user.click(await screen.findByRole("button", { name: "tocar mapa" }));
    expect(screen.getByLabelText("Latitud")).toHaveValue("9.301111");

    await user.clear(screen.getByLabelText("Latitud"));
    expect(ubicacionActual().latitud).toBeNull();
  });

  it("si no carga ningún mosaico, quita el mapa y abre las coordenadas con un aviso", async () => {
    render(<UbicacionControlada inicial={sinPunto} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "fallan los mosaicos" }));
    expect(screen.getByText(/No pudimos cargar el mapa/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "tocar mapa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Escribir coordenadas" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Latitud"), "9.3");
    expect(ubicacionActual().latitud).toBe(9.3);
  });
});

describe("capaMapa", () => {
  it("usa OpenStreetMap por defecto y otro proveedor con VITE_MAP_TILES_URL y VITE_MAP_ATTRIBUTION", () => {
    expect(capaMapa()).toEqual({
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      atribucion: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });
    vi.stubEnv("VITE_MAP_TILES_URL", "https://mosaicos.ejemplo.com/{z}/{x}/{y}.png?key=abc");
    vi.stubEnv("VITE_MAP_ATTRIBUTION", "&copy; Ejemplo &copy; OpenStreetMap");
    expect(capaMapa()).toEqual({
      url: "https://mosaicos.ejemplo.com/{z}/{x}/{y}.png?key=abc",
      atribucion: "&copy; Ejemplo &copy; OpenStreetMap",
    });
  });
});
