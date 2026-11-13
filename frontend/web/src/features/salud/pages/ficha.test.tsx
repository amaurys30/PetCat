import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RegistroHistorial, ResumenSalud, Vacuna } from "@/api/salud";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { citaPanelDemo } from "@/test/agenda";
import { negocioDemo, renderRuta, usuarioDemo } from "@/test/render";
import { registroDemo, resumenDemo, vacunaDemo } from "@/test/salud";
import { API, fallo, http, HttpResponse, ok, servidor } from "@/test/servidor";

const RUTA = "/n/1/clientes/mascotas/31";

const pagina = <T,>(data: T[]) =>
  HttpResponse.json({
    success: true,
    message: "OK",
    data,
    meta: { total: data.length, page: 1, limit: 10, totalPages: 1, hasNext: false },
  });

interface Registro {
  historial: URL[];
  citas: number;
}

function base(
  registro: Registro,
  {
    resumen = resumenDemo(),
    historial = () => [
      registroDemo({
        notas_internas: "Revisar cadera en el próximo control",
        archivos: [
          {
            id_archivo: 7,
            tipo: "imagen",
            nombre: "radiografia_cadera.jpg",
            bytes: 1000,
            url: "https://archivos.test/radiografia?firma=1",
            url_expira_en: new Date(Date.now() + 10 * 60_000).toISOString(),
            externo: false,
          },
        ],
      }),
      registroDemo({
        id_historial: 11,
        fecha: "2026-05-02",
        tipo: "urgencia",
        diagnostico: "Otitis externa.",
        es_propio: false,
        notas_internas: undefined,
        negocio: { id_negocio: 4, nombre: "Salud Animal 24h" },
        empleado: { id_empleado: 9, nombre: "Paula", apellido: "Rojas" },
      }),
    ],
    vacunas = [
      vacunaDemo(),
      vacunaDemo({
        id_vacuna: 2,
        nombre_vacuna: "Moquillo",
        fecha_aplicacion: "2025-10-14",
        fecha_proxima: "2026-10-14",
        estado: "proximo",
        registrada_por: "dueno",
        tiene_comprobante: true,
        negocio: null,
        comprobante: { url: "https://cdn.test/carnet.jpg", externo: true },
      }),
      vacunaDemo({
        id_vacuna: 3,
        fecha_aplicacion: "2024-09-13",
        fecha_proxima: "2025-09-13",
        estado: "no_aplica",
      }),
    ],
  }: {
    resumen?: ResumenSalud | (() => Response);
    historial?: () => RegistroHistorial[];
    vacunas?: Vacuna[];
  } = {},
) {
  return [
    http.get(`${API}/negocios/1/mascotas/31/resumen-salud`, () =>
      typeof resumen === "function" ? resumen() : ok(resumen),
    ),
    http.get(`${API}/negocios/1/mascotas/31/historial`, ({ request }) => {
      registro.historial.push(new URL(request.url));
      return pagina(historial());
    }),
    http.get(`${API}/negocios/1/mascotas/31/vacunas`, () => ok(vacunas)),
    http.get(`${API}/negocios/1/mascotas/31/citas`, () => {
      registro.citas++;
      return pagina([citaPanelDemo({ id_cita: 400, estado: "completada" })]);
    }),
  ];
}

const nuevoRegistro = (): Registro => ({ historial: [], citas: 0 });

const conRol = (permisos: Record<string, string[]>) =>
  usuarioDemo({
    negocios: [
      negocioDemo({ relacion: "empleado", rol: { id_rol: 5, nombre: "Rol", permisos_json: permisos } }),
    ],
  });

beforeEach(() => __reiniciarSesionParaPruebas());
afterEach(() => vi.restoreAllMocks());

describe("C2 · Ficha de la mascota", () => {
  it("cabecera, resumen, historial (propio con nota interna, ajeno en solo lectura) y carnet", async () => {
    servidor.use(...base(nuevoRegistro()));
    renderRuta(RUTA, { usuario: usuarioDemo() });

    expect(await screen.findByRole("heading", { name: /Max/ })).toBeInTheDocument();
    const ruta = screen.getByRole("navigation", { name: "Ruta" });
    expect(within(ruta).getByRole("link", { name: "Laura Gómez" })).toHaveAttribute(
      "href",
      "/n/1/clientes?cliente=20",
    );
    expect(screen.getByText(/Perro · Labrador · Macho · 6 años \(12 mar 2020\) · 28 kg/)).toBeInTheDocument();
    expect(screen.getByText("Microchip 985…421")).toHaveAttribute("title", "985000000000421");
    expect(screen.getByText(/Alergia: penicilina/)).toBeInTheDocument();
    expect(screen.getByText("Condición: displasia de cadera")).toBeInTheDocument();
    expect(screen.getByText("Comparte su historial completo")).toBeInTheDocument();

    const resumen = screen.getByLabelText("Resumen de salud");
    expect(within(resumen).getByText(/Antirrábica · hace/)).toBeInTheDocument();
    expect(within(resumen).getByText("Consulta · Clínica Veterinaria Patitas")).toBeInTheDocument();
    expect(within(resumen).getByText("3,7 % · estable")).toBeInTheDocument();

    const historial = await screen.findByRole("list", { name: "Historial médico" });
    const [propio, ajeno] = within(historial).getAllByRole("article");
    expect(within(propio!).getByText(/Nota interna \(solo tu negocio\): Revisar cadera/)).toBeInTheDocument();
    expect(within(propio!).getByRole("button", { name: "radiografia_cadera.jpg" })).toBeInTheDocument();
    expect(within(ajeno!).getByText(/Otro negocio · solo lectura/)).toBeInTheDocument();
    expect(within(ajeno!).getByText("Salud Animal 24h · Paula Rojas")).toBeInTheDocument();
    expect(within(ajeno!).queryByText(/Nota interna/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/no comparte el historial de otros negocios: ves solo/i),
    ).not.toBeInTheDocument();

    // El carnet muestra las vigentes; la del dueño con clip; la dosis anterior no.
    const carnet = screen.getByRole("region", { name: "Carnet de vacunas" });
    expect(within(carnet).getByText("Vencida")).toBeInTheDocument();
    expect(within(carnet).getByText("Dueño")).toBeInTheDocument();
    expect(within(carnet).getByLabelText("con comprobante")).toBeInTheDocument();
    expect(within(carnet).queryByText("No aplica")).not.toBeInTheDocument();
  });

  it("sin compartir_historial lo avisa en la cabecera y en el historial", async () => {
    servidor.use(
      ...base(nuevoRegistro(), { resumen: resumenDemo({ mascota: { compartir_historial: false } }) }),
    );
    renderRuta(RUTA, { usuario: usuarioDemo() });
    expect(await screen.findByText("No comparte el historial de otros negocios")).toBeInTheDocument();
    expect(await screen.findByText(/ves solo los registros de tu negocio/)).toBeInTheDocument();
  });

  it("filtra por tipo y por el último año", async () => {
    const user = userEvent.setup();
    const registro = nuevoRegistro();
    servidor.use(...base(registro));
    renderRuta(RUTA, { usuario: usuarioDemo() });
    await screen.findByRole("list", { name: "Historial médico" });

    await user.click(screen.getByRole("combobox", { name: "Tipo de registro" }));
    await user.click(await screen.findByRole("option", { name: "Urgencia" }));
    await waitFor(() => expect(registro.historial.at(-1)!.searchParams.get("tipo")).toBe("urgencia"));
    await user.click(screen.getByRole("combobox", { name: "Período" }));
    await user.click(await screen.findByRole("option", { name: "Último año" }));
    await waitFor(() =>
      expect(registro.historial.at(-1)!.searchParams.get("desde")).toMatch(/^\d{4}-\d{2}-\d{2}$/),
    );
  });

  it("abre un archivo vigente directo; si la URL venció, vuelve a pedir el historial y abre la nueva", async () => {
    const user = userEvent.setup();
    const registro = nuevoRegistro();
    let firma = 0;
    const archivo = (expira: number) => ({
      id_archivo: 7,
      tipo: "pdf" as const,
      nombre: "examen.pdf",
      bytes: 1000,
      url: `https://archivos.test/examen?firma=${++firma}`,
      url_expira_en: new Date(expira).toISOString(),
      externo: false,
    });
    // La primera respuesta trae una URL ya vencida; las siguientes, vigentes.
    servidor.use(
      ...base(registro, {
        historial: () => [
          registroDemo({ archivos: [archivo(firma === 0 ? Date.now() - 60_000 : Date.now() + 10 * 60_000)] }),
        ],
      }),
    );
    const pestana = { opener: {}, location: { href: "" }, close: vi.fn() };
    const abrir = vi.spyOn(window, "open").mockReturnValue(pestana as unknown as Window);
    renderRuta(RUTA, { usuario: usuarioDemo() });

    await user.click(await screen.findByRole("button", { name: "examen.pdf" }));
    await waitFor(() => expect(pestana.location.href).toBe("https://archivos.test/examen?firma=2"));
    expect(abrir).toHaveBeenCalledWith("", "_blank");
    expect(pestana.opener).toBeNull();
    expect(registro.historial).toHaveLength(2);

    // Ya vigente: se abre directo, sin pedir otra vez.
    await user.click(screen.getByRole("button", { name: "examen.pdf" }));
    expect(abrir).toHaveBeenLastCalledWith(
      "https://archivos.test/examen?firma=2",
      "_blank",
      "noopener,noreferrer",
    );
    expect(registro.historial).toHaveLength(2);
  });

  it("pestaña Vacunas con dosis anteriores, detalle y comprobante; pestaña Citas", async () => {
    const user = userEvent.setup();
    const registro = nuevoRegistro();
    servidor.use(...base(registro));
    renderRuta(`${RUTA}?pestana=vacunas`, { usuario: usuarioDemo() });
    const panel = await screen.findByRole("tabpanel", { name: "Vacunas" });
    expect(await within(panel).findAllByText("Refuerzo anual · Zoetis · Lote RB-2291")).toHaveLength(2);
    expect(within(panel).getByRole("button", { name: "Comprobante" })).toBeInTheDocument();
    expect(within(panel).queryByText("No aplica")).not.toBeInTheDocument();
    await user.click(within(panel).getByRole("switch"));
    expect(within(panel).getByText("No aplica")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Citas" }));
    expect(await screen.findByText("Consulta general")).toBeInTheDocument();
    expect(registro.citas).toBe(1);
  });

  it("carnet y pestaña Vacunas ordenan por fecha de aplicación, de la más reciente a la más antigua", async () => {
    const user = userEvent.setup();
    const vacunas = [
      vacunaDemo({
        id_vacuna: 4,
        nombre_vacuna: "Parvovirus",
        fecha_aplicacion: "2023-03-01",
        estado: "al_dia",
      }),
      vacunaDemo({ id_vacuna: 3, fecha_aplicacion: "2024-09-13", estado: "no_aplica" }),
      vacunaDemo(),
      vacunaDemo({
        id_vacuna: 2,
        nombre_vacuna: "Moquillo",
        fecha_aplicacion: "2025-10-14",
        estado: "proximo",
      }),
    ];
    servidor.use(...base(nuevoRegistro(), { vacunas }));
    const nombres = (contenedor: HTMLElement) =>
      within(contenedor)
        .getAllByRole("row")
        .slice(1)
        .map(
          (fila) =>
            `${within(fila).getAllByRole("cell")[0]!.textContent} ${within(fila).getAllByRole("cell")[1]!.textContent}`,
        );

    renderRuta(`${RUTA}?pestana=vacunas`, { usuario: usuarioDemo() });
    const carnet = await screen.findByRole("region", { name: "Carnet de vacunas" });
    await within(carnet).findByText("Moquillo");
    expect(nombres(carnet).map((n) => n.split(" ")[0])).toEqual(["Moquillo", "Antirrábica", "Parvovirus"]);

    // Con las dosis anteriores, la "No aplica" queda en su lugar por fecha, no al final.
    const panel = screen.getByRole("tabpanel", { name: "Vacunas" });
    await user.click(within(panel).getByRole("switch"));
    expect(nombres(panel)).toEqual([
      "Moquillo 14 oct 2025",
      "Antirrábica 13 sep 2025",
      "Antirrábica 13 sep 2024",
      "Parvovirus 1 mar 2023",
    ]);
  });

  it("sin cita válida (403) explica por qué no se ve la ficha", async () => {
    servidor.use(
      ...base(nuevoRegistro(), { resumen: () => fallo(403, "Esta mascota no tiene citas con el negocio") }),
    );
    renderRuta(RUTA, { usuario: usuarioDemo() });
    expect(
      await screen.findByText(/Esta mascota no tiene citas con el negocio\. Un negocio ve la ficha/),
    ).toBeInTheDocument();
  });

  it("los permisos deciden las pestañas: solo vacunas.ver no ve el historial; citas.ver ve las citas", async () => {
    const registro = nuevoRegistro();
    servidor.use(...base(registro));
    renderRuta(RUTA, { usuario: conRol({ vacunas: ["ver"], citas: ["ver"] }) });
    await screen.findByRole("heading", { name: /Max/ });
    const pestanas = screen.getByRole("tablist", { name: "Secciones de la ficha" });
    expect(
      within(pestanas)
        .getAllByRole("tab")
        .map((t) => t.textContent),
    ).toEqual(["Vacunas", "Citas"]);
    // Sin clientes.ver, el dueño no es un enlace.
    expect(
      within(screen.getByRole("navigation", { name: "Ruta" })).queryByRole("link"),
    ).not.toBeInTheDocument();
    expect(registro.historial).toHaveLength(0);
  });

  it("sin historial_medico.ver ni vacunas.ver no hay ficha", async () => {
    servidor.use(...base(nuevoRegistro()));
    renderRuta(RUTA, { usuario: conRol({ citas: ["ver"] }) });
    expect(
      await screen.findByText("Tu rol no incluye el historial médico ni las vacunas."),
    ).toBeInTheDocument();
  });
});
