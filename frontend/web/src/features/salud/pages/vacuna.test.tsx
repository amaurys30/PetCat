import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { Vacuna } from "@/api/salud";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { sumarDias } from "@/lib/agenda";
import { hoyISO } from "@/lib/format";
import { profesionalDemo } from "@/test/agenda";
import { renderRuta, usuarioDemo } from "@/test/render";
import { registroDemo, resumenDemo, vacunaDemo } from "@/test/salud";
import { API, fallo, http, HttpResponse, ok, servidor } from "@/test/servidor";

const RUTA = "/n/1/clientes/mascotas/31";
const HOY = hoyISO();
const EN_UN_ANIO = sumarDias(HOY, 365);

const pagina = <T,>(data: T[]) =>
  HttpResponse.json({
    success: true,
    message: "OK",
    data,
    meta: { total: data.length, page: 1, limit: 20, totalPages: 1, hasNext: false },
  });

interface Registro {
  creadas: Record<string, unknown>[];
  ediciones: Record<string, unknown>[];
  comprobantes: number;
  quitados: number;
  registros: Record<string, unknown>[];
}
const nuevoRegistro = (): Registro => ({
  creadas: [],
  ediciones: [],
  comprobantes: 0,
  quitados: 0,
  registros: [],
});

const comprobante = () => new File(["x"], "carnet.png", { type: "image/png" });

function base(
  registro: Registro,
  {
    vacunas = [vacunaDemo()] as Vacuna[],
    fallecido = false,
    subir,
  }: { vacunas?: Vacuna[]; fallecido?: boolean; subir?: (intento: number) => Response | undefined } = {},
) {
  return [
    http.get(`${API}/negocios/1/mascotas/31/resumen-salud`, () =>
      ok(resumenDemo({ mascota: { fallecido } })),
    ),
    http.get(`${API}/negocios/1/mascotas/31/historial`, () => pagina([])),
    http.get(`${API}/negocios/1/mascotas/31/vacunas`, () => ok(vacunas)),
    http.get(`${API}/negocios/1/mascotas/31/citas`, () => pagina([])),
    http.get(`${API}/negocios/1/profesionales`, () => ok([profesionalDemo()])),
    http.post(`${API}/negocios/1/vacunas`, async ({ request }) => {
      const cuerpo = (await request.json()) as Record<string, unknown>;
      registro.creadas.push(cuerpo);
      return ok(vacunaDemo({ id_vacuna: 50, nombre_vacuna: String(cuerpo.nombre_vacuna) }), 201);
    }),
    http.patch(`${API}/vacunas/:id`, async ({ request }) => {
      registro.ediciones.push((await request.json()) as Record<string, unknown>);
      return ok(vacunaDemo({ ediciones: 1 }));
    }),
    http.put(`${API}/vacunas/:id/comprobante`, () => {
      registro.comprobantes++;
      return subir?.(registro.comprobantes) ?? ok(vacunaDemo({ id_vacuna: 50, tiene_comprobante: true }));
    }),
    http.delete(`${API}/vacunas/:id/comprobante`, () => {
      registro.quitados++;
      return ok(vacunaDemo({ comprobante: null, tiene_comprobante: false }));
    }),
    http.post(`${API}/negocios/1/historial`, async ({ request }) => {
      const cuerpo = (await request.json()) as Record<string, unknown>;
      registro.registros.push(cuerpo);
      return ok(registroDemo({ id_historial: 88, tipo: "vacunacion", fecha: HOY }), 201);
    }),
  ];
}

beforeEach(() => __reiniciarSesionParaPruebas());

async function abrirNueva(user: ReturnType<typeof userEvent.setup>) {
  // "+ Vacuna" de la cabecera (el carnet tiene otro igual).
  await screen.findByRole("heading", { name: /Max/ });
  await user.click(screen.getAllByRole("button", { name: "Vacuna" })[0]!);
  return screen.findByRole("dialog", { name: "Registrar vacuna · Max" });
}

describe("C5 · Registrar vacuna", () => {
  it("con sugerencias, avisa la dosis que pasa a No aplica y los recordatorios, y sube el comprobante", async () => {
    const user = userEvent.setup();
    const registro = nuevoRegistro();
    servidor.use(...base(registro));
    renderRuta(RUTA, { usuario: usuarioDemo() });
    const d = await abrirNueva(user);

    // Max es perro: sugerencias de perro.
    expect(within(d).getByRole("button", { name: "Parvovirus" })).toBeInTheDocument();
    await user.click(within(d).getByRole("button", { name: "Antirrábica" }));
    expect(within(d).getByLabelText("Vacuna *")).toHaveValue("Antirrábica");
    expect(
      within(d).getByText(
        /La dosis anterior de Antirrábica \(aplicada el 13 sep 2025\) pasará a "No aplica"/,
      ),
    ).toBeInTheDocument();

    await user.type(within(d).getByLabelText("Próxima dosis"), EN_UN_ANIO);
    expect(
      within(d).getByText(/recibirá recordatorios 7 días antes, el día y 7 días después/),
    ).toBeInTheDocument();
    await user.type(within(d).getByLabelText("Lote"), "RB-3001");
    await user.upload(within(d).getByLabelText(/Subir comprobante/), comprobante());
    await user.click(within(d).getByRole("button", { name: "Guardar vacuna" }));

    expect(await screen.findByText("Vacuna registrada en el carnet")).toBeInTheDocument();
    expect(registro.creadas).toEqual([
      {
        id_mascota: 31,
        nombre_vacuna: "Antirrábica",
        fecha_aplicacion: HOY,
        fecha_proxima: EN_UN_ANIO,
        lote: "RB-3001",
      },
    ]);
    expect(registro.comprobantes).toBe(1);
  });

  it("valida las fechas: aplicación no futura y próxima dosis posterior", async () => {
    const user = userEvent.setup();
    const registro = nuevoRegistro();
    servidor.use(...base(registro));
    renderRuta(RUTA, { usuario: usuarioDemo() });
    const d = await abrirNueva(user);
    await user.type(within(d).getByLabelText("Vacuna *"), "Moquillo");
    await user.type(within(d).getByLabelText("Próxima dosis"), sumarDias(HOY, -1));
    await user.click(within(d).getByRole("button", { name: "Guardar vacuna" }));
    expect(await within(d).findByText("Debe ser posterior a la fecha de aplicación")).toBeInTheDocument();
    expect(registro.creadas).toEqual([]);
  });

  it("si el comprobante no sube, la vacuna ya existe: lo dice y reintenta solo el comprobante", async () => {
    const user = userEvent.setup();
    const registro = nuevoRegistro();
    servidor.use(
      ...base(registro, { subir: (n) => (n === 1 ? fallo(503, "Cloudinary no responde") : undefined) }),
    );
    renderRuta(RUTA, { usuario: usuarioDemo() });
    const d = await abrirNueva(user);
    await user.type(within(d).getByLabelText("Vacuna *"), "Moquillo");
    await user.upload(within(d).getByLabelText(/Subir comprobante/), comprobante());
    await user.click(within(d).getByRole("button", { name: "Guardar vacuna" }));
    expect(
      await within(d).findByText(
        /La vacuna quedó en el carnet, pero no se pudo subir el comprobante \(carnet.png\)/,
      ),
    ).toBeInTheDocument();
    await user.click(within(d).getByRole("button", { name: "Reintentar la subida" }));
    expect(await screen.findByText("Vacuna registrada en el carnet")).toBeInTheDocument();
    expect(registro.creadas).toHaveLength(1);
    expect(registro.comprobantes).toBe(2);
  });

  it("una mascota fallecida no admite vacunas nuevas", async () => {
    servidor.use(...base(nuevoRegistro(), { fallecido: true }));
    renderRuta(RUTA, { usuario: usuarioDemo() });
    await screen.findByRole("heading", { name: /Max/ });
    const botones = screen.getAllByRole("button", { name: /Vacuna$/ });
    expect(botones.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });

  it("desde un registro de vacunación abre C5 vinculado a ese registro", async () => {
    const user = userEvent.setup();
    const registro = nuevoRegistro();
    servidor.use(...base(registro, { vacunas: [] }));
    renderRuta(RUTA, { usuario: usuarioDemo() });
    await user.click(await screen.findByRole("button", { name: "Registro médico" }));
    const c4 = await screen.findByRole("dialog", { name: "Nuevo registro médico · Max" });
    await user.click(within(c4).getByRole("radio", { name: "Vacunación" }));
    await user.click(within(c4).getByRole("button", { name: "Guardar registro" }));
    await user.click(await within(c4).findByRole("button", { name: /Registrar también en el carnet/ }));

    const c5 = await screen.findByRole("dialog", { name: "Registrar vacuna · Max" });
    expect(within(c5).getByRole("combobox", { name: "Vincular a registro médico" })).toBeDisabled();
    await user.type(within(c5).getByLabelText("Vacuna *"), "Parvovirus");
    await user.click(within(c5).getByRole("button", { name: "Guardar vacuna" }));
    expect(await screen.findByText("Vacuna registrada en el carnet")).toBeInTheDocument();
    expect(registro.creadas[0]).toMatchObject({
      id_historial_medico: 88,
      fecha_aplicacion: HOY,
      id_empleado: 1,
    });
  });
});

describe("C5 · Editar una vacuna del negocio", () => {
  const propia = vacunaDemo({
    fecha_proxima: "2026-09-13",
    comprobante: {
      id_archivo: 4,
      tipo: "imagen",
      nombre: "carnet.jpg",
      bytes: 100,
      url: "https://archivos.test/carnet",
      url_expira_en: new Date(Date.now() + 600_000).toISOString(),
      externo: false,
    },
    tiene_comprobante: true,
    edicion: {
      fecha: "2026-10-20 08:15:00",
      usuario: { id_usuario: 3, nombre: "Carlos", apellido: "Martínez" },
    },
    ediciones: 1,
  });
  const delDueno = vacunaDemo({
    id_vacuna: 2,
    nombre_vacuna: "Moquillo",
    registrada_por: "dueno",
    negocio: null,
    estado: "al_dia",
  });
  const deOtro = vacunaDemo({
    id_vacuna: 3,
    nombre_vacuna: "Leptospirosis",
    negocio: { id_negocio: 4, nombre: "Salud Animal" },
    estado: "al_dia",
  });

  it("muestra quién la editó; solo las propias se editan; al cambiar la próxima dosis avisa que se reprograman los recordatorios", async () => {
    const user = userEvent.setup();
    const registro = nuevoRegistro();
    servidor.use(...base(registro, { vacunas: [propia, delDueno, deOtro] }));
    renderRuta(`${RUTA}?pestana=vacunas`, { usuario: usuarioDemo() });
    const panel = await screen.findByRole("tabpanel", { name: "Vacunas" });
    expect(
      await within(panel).findByText("Editado por Carlos Martínez · 20 oct 2026, 08:15"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Carnet de vacunas" })).getByText("editada"),
    ).toBeInTheDocument();
    expect(within(panel).getAllByRole("button", { name: /^Editar / })).toHaveLength(1);

    await user.click(within(panel).getByRole("button", { name: "Editar Antirrábica" }));
    const d = await screen.findByRole("dialog", { name: "Editar vacuna · Max" });
    expect(within(d).queryByText(/pasará a "No aplica"/)).not.toBeInTheDocument();
    const proxima = within(d).getByLabelText("Próxima dosis");
    await user.clear(proxima);
    await user.type(proxima, "2027-09-13");
    expect(
      within(d).getByText(
        "Los recordatorios del dueño se reprogramarán con la nueva fecha: 7 días antes, el día y 7 días después del 13 sep 2027.",
      ),
    ).toBeInTheDocument();
    await user.clear(proxima);
    expect(
      within(d).getByText("Sin próxima dosis, el dueño ya no recibirá recordatorios de esta vacuna."),
    ).toBeInTheDocument();
    await user.type(proxima, "2027-09-13");

    await user.click(within(d).getByRole("button", { name: "Quitar comprobante" }));
    const confirmar = await screen
      .findByRole("alertdialog", { name: "¿Quitar el comprobante?" })
      .catch(() => screen.findByRole("dialog", { name: "¿Quitar el comprobante?" }));
    await user.click(within(confirmar).getByRole("button", { name: "Quitar comprobante" }));
    await waitFor(() => expect(registro.quitados).toBe(1));

    await user.click(within(d).getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Vacuna actualizada")).toBeInTheDocument();
    expect(registro.ediciones).toEqual([{ fecha_proxima: "2027-09-13" }]);
  });
});
