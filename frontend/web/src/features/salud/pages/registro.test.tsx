import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { RegistroHistorial } from "@/api/salud";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { sumarDias } from "@/lib/agenda";
import { hoyISO } from "@/lib/format";
import { citaPanelDemo, profesionalDemo } from "@/test/agenda";
import { renderRuta, usuarioDemo } from "@/test/render";
import { registroDemo, resumenDemo } from "@/test/salud";
import { API, fallo, http, HttpResponse, ok, servidor } from "@/test/servidor";

const RUTA = "/n/1/clientes/mascotas/31";
const HOY = hoyISO();
const HACE_10 = sumarDias(HOY, -10);

const pagina = <T,>(data: T[]) =>
  HttpResponse.json({
    success: true,
    message: "OK",
    data,
    meta: { total: data.length, page: 1, limit: 20, totalPages: 1, hasNext: false },
  });

interface Registro {
  creados: Record<string, unknown>[];
  ediciones: Record<string, unknown>[];
  /** Cuántos archivos llegó en cada envío. */
  envios: number[];
  borrados: string[];
}

const nuevoRegistro = (): Registro => ({ creados: [], ediciones: [], envios: [], borrados: [] });

const archivos = (n: number, tipo = "image/png") =>
  Array.from({ length: n }, (_, i) => new File(["x"], `foto${i + 1}.png`, { type: tipo }));

function base(
  registro: Registro,
  {
    historial = [] as RegistroHistorial[],
    registrosDeLaCita = [] as { id_historial: number; tipo: string; fecha: string }[],
    subir,
  }: {
    historial?: RegistroHistorial[];
    registrosDeLaCita?: { id_historial: number; tipo: string; fecha: string }[];
    subir?: (envio: number) => Response | undefined;
  } = {},
) {
  return [
    http.get(`${API}/negocios/1/mascotas/31/resumen-salud`, () => ok(resumenDemo())),
    http.get(`${API}/negocios/1/mascotas/31/historial`, () => pagina(historial)),
    http.get(`${API}/negocios/1/mascotas/31/vacunas`, () => ok([])),
    http.get(`${API}/negocios/1/mascotas/31/citas`, () =>
      pagina([
        {
          ...citaPanelDemo({ id_cita: 400, fecha: HACE_10, estado: "completada" }),
          registros_medicos: registrosDeLaCita,
        },
        // Futura: no se ofrece para vincular.
        { ...citaPanelDemo({ id_cita: 401, fecha: sumarDias(HOY, 5) }), registros_medicos: [] },
      ]),
    ),
    http.get(`${API}/negocios/1/profesionales`, () =>
      ok([profesionalDemo(), profesionalDemo({ id_empleado: 2, nombre: "Paula", apellido: "Rojas" })]),
    ),
    http.post(`${API}/negocios/1/historial`, async ({ request }) => {
      const cuerpo = (await request.json()) as Record<string, unknown>;
      registro.creados.push(cuerpo);
      return ok(
        registroDemo({ id_historial: 77, tipo: String(cuerpo.tipo), fecha: String(cuerpo.fecha) }),
        201,
      );
    }),
    http.patch(`${API}/historial/:id`, async ({ request }) => {
      registro.ediciones.push((await request.json()) as Record<string, unknown>);
      return ok(registroDemo({ edicion: { fecha: "2026-10-17 10:00:00", usuario: null }, ediciones: 1 }));
    }),
    http.post(`${API}/historial/:id/archivos`, async ({ request }) => {
      // MSW no lee el multipart que arma jsdom: se cuentan las partes en el cuerpo crudo.
      const crudo = await request.text();
      registro.envios.push(crudo.split('name="archivos"').length - 1);
      return subir?.(registro.envios.length) ?? ok(registroDemo({ id_historial: 77 }), 201);
    }),
    http.delete(`${API}/historial/:id/archivos/:idArchivo`, ({ params }) => {
      registro.borrados.push(String(params.idArchivo));
      return ok(registroDemo({ archivos: [] }));
    }),
  ];
}

beforeEach(() => __reiniciarSesionParaPruebas());

async function abrirNuevo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Registro médico" }));
  return screen.findByRole("dialog", { name: "Nuevo registro médico · Max" });
}

describe("C4 · Nuevo registro médico", () => {
  it("vincula la cita (trae su fecha), envía los datos y sube los archivos de a 5", async () => {
    const user = userEvent.setup();
    const registro = nuevoRegistro();
    servidor.use(...base(registro));
    renderRuta(RUTA, { usuario: usuarioDemo() });
    const d = await abrirNuevo(user);
    expect(within(d).getByText(/Alergia: penicilina/)).toBeInTheDocument();

    await user.click(within(d).getByRole("radio", { name: "Control" }));
    await user.click(within(d).getByRole("combobox", { name: "Vincular a una cita" }));
    expect(screen.queryByRole("option", { name: /Cita del/ })).not.toBeInTheDocument();
    // Solo la cita pasada: la futura no se ofrece.
    expect(screen.getAllByRole("option")).toHaveLength(2);
    await user.click(screen.getByRole("option", { name: /Consulta general/ }));
    expect(within(d).getByLabelText("Fecha *")).toHaveValue(HACE_10);
    expect(within(d).getByRole("combobox", { name: "Profesional" })).toHaveTextContent("Carlos Pérez");

    await user.type(within(d).getByLabelText("Diagnóstico"), "Displasia leve, estable.");
    await user.type(within(d).getByLabelText("Peso (kg)"), "28,4");
    await user.type(within(d).getByLabelText("Notas internas (solo las ve tu negocio)"), "Revisar cadera");
    await user.upload(within(d).getByLabelText(/Arrastra archivos/), archivos(7));
    expect(within(d).getByRole("list", { name: "Archivos por subir" }).children).toHaveLength(7);

    await user.click(within(d).getByRole("button", { name: "Guardar registro" }));
    expect(await screen.findByText("Registro médico guardado")).toBeInTheDocument();
    expect(registro.creados).toEqual([
      {
        id_mascota: 31,
        id_cita: 400,
        tipo: "control",
        fecha: HACE_10,
        id_empleado: 1,
        diagnostico: "Displasia leve, estable.",
        peso_registro: 28.4,
        notas_internas: "Revisar cadera",
      },
    ]);
    expect(registro.envios).toEqual([5, 2]);
  });

  it("valida fecha, próximo control, signos vitales y archivos antes de enviar", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const registro = nuevoRegistro();
    servidor.use(...base(registro));
    renderRuta(RUTA, { usuario: usuarioDemo() });
    const d = await abrirNuevo(user);

    const fecha = within(d).getByLabelText("Fecha *");
    await user.clear(fecha);
    await user.type(fecha, sumarDias(HOY, 1));
    await user.type(within(d).getByLabelText("Temperatura (°C)"), "50");
    await user.type(within(d).getByLabelText("Frec. cardiaca"), "80,5");
    await user.type(within(d).getByLabelText("Próximo control"), sumarDias(HOY, -30));
    await user.click(within(d).getByRole("button", { name: "Guardar registro" }));
    expect(await within(d).findByText("No puede ser una fecha futura")).toBeInTheDocument();
    expect(within(d).getByText("Temperatura entre 25 y 45 °C")).toBeInTheDocument();
    expect(within(d).getByText("Entre 1 y 500 latidos por minuto")).toBeInTheDocument();
    expect(registro.creados).toEqual([]);

    const grande = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "rx.pdf", { type: "application/pdf" });
    await user.upload(within(d).getByLabelText(/Arrastra archivos/), [
      new File(["x"], "notas.txt", { type: "text/plain" }),
      grande,
      ...archivos(11),
    ]);
    const alerta = within(d)
      .getAllByRole("alert")
      .find((a) => a.textContent?.includes("notas.txt"))!;
    expect(alerta).toHaveTextContent("notas.txt: solo JPG, PNG, WebP o PDF");
    expect(alerta).toHaveTextContent("rx.pdf: pesa más de 10 MB");
    expect(alerta).toHaveTextContent("Solo caben 10 archivos más");
    expect(within(d).getByRole("list", { name: "Archivos por subir" }).children).toHaveLength(10);
    expect(within(d).getByText("Ya no caben más archivos")).toBeInTheDocument();
  });

  it("si un envío de archivos falla, el registro ya existe: dice cuáles faltan y reintenta solo esos", async () => {
    const user = userEvent.setup();
    const registro = nuevoRegistro();
    servidor.use(
      ...base(registro, {
        subir: (envio) => (envio === 2 ? fallo(503, "Cloudinary no responde") : undefined),
      }),
    );
    renderRuta(RUTA, { usuario: usuarioDemo() });
    const d = await abrirNuevo(user);
    await user.upload(within(d).getByLabelText(/Arrastra archivos/), archivos(7));
    await user.click(within(d).getByRole("button", { name: "Guardar registro" }));

    expect(
      await within(d).findByText(/El registro se guardó, pero no se pudieron subir estos 2 archivos/),
    ).toHaveTextContent("foto6.png, foto7.png. Cloudinary no responde");
    await user.click(within(d).getByRole("button", { name: "Reintentar la subida" }));
    expect(await screen.findByText("Registro médico guardado")).toBeInTheDocument();
    expect(registro.creados).toHaveLength(1);
    expect(registro.envios).toEqual([5, 2, 2]);
  });

  it("avisa si la cita ya tiene registro, sin impedir otro", async () => {
    const user = userEvent.setup();
    servidor.use(
      ...base(nuevoRegistro(), {
        registrosDeLaCita: [{ id_historial: 5, tipo: "consulta_general", fecha: HACE_10 }],
      }),
    );
    renderRuta(RUTA, { usuario: usuarioDemo() });
    const d = await abrirNuevo(user);
    await user.click(within(d).getByRole("combobox", { name: "Vincular a una cita" }));
    await user.click(screen.getByRole("option", { name: /con registro/ }));
    expect(within(d).getByText(/Esta cita ya tiene un registro \(Consulta,/)).toBeInTheDocument();
    expect(within(d).getByRole("button", { name: "Guardar registro" })).toBeEnabled();
  });

  it("un registro de vacunación ofrece registrarla en el carnet (el botón está activo)", async () => {
    const user = userEvent.setup();
    servidor.use(...base(nuevoRegistro()));
    renderRuta(RUTA, { usuario: usuarioDemo() });
    const d = await abrirNuevo(user);
    await user.click(within(d).getByRole("radio", { name: "Vacunación" }));
    expect(within(d).getByText(/podrás registrarla también en el carnet/)).toBeInTheDocument();
    await user.click(within(d).getByRole("button", { name: "Guardar registro" }));
    expect(await within(d).findByText("Registro de vacunación guardado.")).toBeInTheDocument();
    expect(within(d).getByRole("button", { name: /Registrar también en el carnet/ })).toBeEnabled();
    await user.click(within(d).getByRole("button", { name: "Ahora no" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("C4 · Editar un registro propio", () => {
  const propio = registroDemo({
    archivos: [
      {
        id_archivo: 9,
        tipo: "pdf",
        nombre: "examen.pdf",
        bytes: 100,
        url: "https://archivos.test/examen",
        url_expira_en: new Date(Date.now() + 600_000).toISOString(),
        externo: false,
      },
    ],
    edicion: {
      fecha: "2026-10-15 09:30:00",
      usuario: { id_usuario: 3, nombre: "Carlos", apellido: "Martínez" },
    },
    ediciones: 2,
  });
  const ajeno = registroDemo({
    id_historial: 11,
    es_propio: false,
    negocio: { id_negocio: 4, nombre: "Salud Animal" },
  });

  it("muestra quién lo editó, envía solo lo que cambió y quita archivos con confirmación; el ajeno no se edita", async () => {
    const user = userEvent.setup();
    const registro = nuevoRegistro();
    servidor.use(...base(registro, { historial: [propio, ajeno] }));
    renderRuta(RUTA, { usuario: usuarioDemo() });
    const lista = await screen.findByRole("list", { name: "Historial médico" });
    const [tarjetaPropia, tarjetaAjena] = within(lista).getAllByRole("article");
    expect(
      within(tarjetaPropia!).getByText("Editado por Carlos Martínez · 15 oct 2026, 09:30 · 2 ediciones"),
    ).toBeInTheDocument();
    expect(within(tarjetaAjena!).queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();

    await user.click(within(tarjetaPropia!).getByRole("button", { name: /Editar/ }));
    const d = await screen.findByRole("dialog", { name: "Editar registro médico · Max" });
    expect(within(d).getByLabelText("Cita vinculada")).toBeDisabled();
    const diagnostico = within(d).getByLabelText("Diagnóstico");
    await user.clear(diagnostico);
    await user.type(diagnostico, "Displasia moderada");
    await user.clear(within(d).getByLabelText("Temperatura (°C)"));

    await user.click(within(d).getByRole("button", { name: "Quitar examen.pdf" }));
    const confirmar = await screen
      .findByRole("alertdialog", { name: "¿Quitar este archivo?" })
      .catch(() => screen.findByRole("dialog", { name: "¿Quitar este archivo?" }));
    await user.click(within(confirmar).getByRole("button", { name: "Quitar archivo" }));
    await waitFor(() => expect(registro.borrados).toEqual(["9"]));

    await user.click(within(d).getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Registro médico actualizado")).toBeInTheDocument();
    expect(registro.ediciones).toEqual([{ diagnostico: "Displasia moderada", temperatura: null }]);
  });

  it("sin historial_medico.editar no aparece Editar", async () => {
    servidor.use(...base(nuevoRegistro(), { historial: [propio] }));
    renderRuta(RUTA, {
      usuario: usuarioDemo({
        negocios: [
          {
            ...usuarioDemo().negocios[0]!,
            relacion: "empleado",
            rol: { id_rol: 5, nombre: "Asistente", permisos_json: { historial_medico: ["ver", "crear"] } },
          },
        ],
      }),
    });
    const lista = await screen.findByRole("list", { name: "Historial médico" });
    expect(within(lista).queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registro médico" })).toBeEnabled();
  });
});
