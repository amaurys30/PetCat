import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { ClienteDetalle, ClienteFila } from "@/api/clientes";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { sumarDias } from "@/lib/agenda";
import { hoyISO } from "@/lib/format";
import { citaPanelDemo, profesionalDemo } from "@/test/agenda";
import { clienteDetalleDemo, clienteFilaDemo, notaDemo } from "@/test/clientes";
import { gestionDemo, negocioDemo, renderRuta, sedeDemo, usuarioDemo } from "@/test/render";
import { API, fallo, http, HttpResponse, ok, servidor } from "@/test/servidor";

const HOY = hoyISO();

const pagina = <T,>(data: T[], { total = data.length, hasNext = false } = {}) =>
  HttpResponse.json({
    success: true,
    message: "OK",
    data,
    meta: { total, page: 1, limit: 20, totalPages: 1, hasNext },
  });

const laura = clienteFilaDemo();
const jorge = clienteFilaDemo({
  id_usuario: 21,
  nombre: "Jorge",
  apellido: "Pérez",
  email: null,
  telefono: "301 222 3344",
  total_citas: 0,
  ultima_cita: null,
  usa_app: false,
  registrado_por_el_negocio: true,
  cliente_desde: HOY,
});
const luis = clienteFilaDemo({
  id_usuario: 22,
  nombre: "Luis",
  apellido: "Díaz",
  email: "luis@petcat.test",
  usa_app: false,
  inasistencias: 3,
});

interface Registro {
  listas: URL[];
  notas: unknown[];
  ediciones: unknown[];
  borradas: string[];
  correos: unknown[];
}

const nuevoRegistro = (): Registro => ({ listas: [], notas: [], ediciones: [], borradas: [], correos: [] });

function base(
  registro: Registro,
  {
    filas = [laura, jorge, luis],
    detalles = {},
    correo,
  }: {
    filas?: ClienteFila[];
    detalles?: Record<number, ClienteDetalle>;
    correo?: (email: string) => Response;
  } = {},
) {
  return [
    http.get(`${API}/negocios/1/clientes`, ({ request }) => {
      const url = new URL(request.url);
      registro.listas.push(url);
      const q = url.searchParams.get("q")?.toLowerCase();
      return pagina(q ? filas.filter((f) => `${f.nombre} ${f.apellido}`.toLowerCase().includes(q)) : filas);
    }),
    http.get(`${API}/negocios/1/clientes/:id`, ({ params }) => {
      const id = Number(params.id);
      const detalle = detalles[id];
      return detalle ? ok(detalle) : fallo(404, "Cliente no encontrado en este negocio");
    }),
    http.post(`${API}/negocios/1/clientes/:id/notas`, async ({ request }) => {
      registro.notas.push(await request.json());
      return ok(notaDemo({ id_nota: 99 }), 201);
    }),
    http.patch(`${API}/notas-cliente/:id`, async ({ request }) => {
      registro.ediciones.push(await request.json());
      return ok(notaDemo());
    }),
    http.delete(`${API}/notas-cliente/:id`, ({ params }) => {
      registro.borradas.push(String(params.id));
      return ok(null);
    }),
    http.put(`${API}/negocios/1/clientes/:id/correo`, async ({ request }) => {
      const cuerpo = (await request.json()) as { email: string };
      registro.correos.push(cuerpo);
      return (
        correo?.(cuerpo.email) ??
        ok({
          cliente: {
            id_usuario: 21,
            nombre: "Jorge",
            apellido: "Pérez",
            email: cuerpo.email,
            telefono: "301 222 3344",
          },
          accion: "agregado",
        })
      );
    }),
  ];
}

const detalleLaura = (cambios: Parameters<typeof clienteDetalleDemo>[0] = {}) =>
  clienteDetalleDemo({
    citas: {
      proximas: [citaPanelDemo({ id_cita: 501, fecha: sumarDias(HOY, 3), hora_inicio: "08:00" })],
      recientes: [
        citaPanelDemo({
          id_cita: 400,
          fecha: "2026-09-12",
          hora_inicio: "10:00",
          estado: "completada",
          servicio: { id_servicio: 2, nombre: "Vacuna antirrábica", duracion_minutos: 15 },
        }),
      ],
    },
    notas_recientes: [
      notaDemo(),
      notaDemo({
        id_nota: 2,
        texto: "Max se estresa con la secadora.",
        autor: { id_usuario: 7, nombre: "Andrés", apellido: "Vega" },
        editable: false,
        eliminable: true,
      }),
    ],
    total_notas: 2,
    ...cambios,
  });

const detalleJorge = (cambios: NonNullable<Parameters<typeof clienteDetalleDemo>[0]>["cliente"] = {}) =>
  clienteDetalleDemo({
    cliente: {
      id_usuario: 21,
      nombre: "Jorge",
      apellido: "Pérez",
      email: null,
      telefono: "301 222 3344",
      usa_app: false,
      registrado_por_el_negocio: true,
      correo_editable: true,
      cliente_desde: HOY,
      ...cambios,
    },
    historial_cumplimiento: { completadas: 0, inasistencias: 0, cancelaciones_tardias: 0 },
  });

beforeEach(() => __reiniciarSesionParaPruebas());

describe("C1 · Clientes", () => {
  it("lista con insignias y elige al primero; el detalle trae cumplimiento, mascotas, notas y citas", async () => {
    const user = userEvent.setup();
    servidor.use(...base(nuevoRegistro(), { detalles: { 20: detalleLaura(), 21: detalleJorge() } }));
    const { router } = renderRuta("/n/1/clientes", { usuario: usuarioDemo() });

    const lista = await screen.findByRole("list", { name: "Clientes" });
    expect(screen.getByText("3 clientes · con citas o registrados por tu negocio")).toBeInTheDocument();
    const [, filaJorge, filaLuis] = within(lista).getAllByRole("button");
    expect(within(filaJorge!).getByText("Sin cuenta")).toBeInTheDocument();
    expect(within(filaJorge!).getByText("Nuevo")).toBeInTheDocument();
    expect(within(filaJorge!).getByText("Registrado aquí")).toBeInTheDocument();
    expect(within(filaLuis!).getByText("3 inasist.")).toBeInTheDocument();
    expect(within(filaLuis!).getByText("Sin app")).toBeInTheDocument();

    // Sin cliente en la URL se elige el primero.
    await waitFor(() => expect(router.state.location.search).toBe("?cliente=20"));
    await waitFor(() =>
      expect(within(lista).getAllByRole("button")[0]).toHaveAttribute("aria-current", "true"),
    );
    expect(await screen.findByRole("heading", { name: "Laura Gómez" })).toBeInTheDocument();
    expect(screen.getByText("Usa la app")).toBeInTheDocument();
    expect(screen.getByText("Cliente desde feb 2026")).toBeInTheDocument();
    const cumplimiento = screen.getByLabelText("Cumplimiento con este negocio");
    expect(within(cumplimiento).getByText("14")).toBeInTheDocument();
    expect(within(cumplimiento).getByText("Cancelaciones tardías")).toBeInTheDocument();
    expect(within(cumplimiento).getByText("Próxima cita")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Llamar/ })).toHaveAttribute("href", "tel:3001234567");

    const mascotas = screen.getByRole("region", { name: "Mascotas" });
    expect(within(mascotas).getByText("Perro · Labrador · 6 años · 28 kg")).toBeInTheDocument();
    expect(within(mascotas).getByText(/Alergia: penicilina/)).toBeInTheDocument();
    expect(within(mascotas).getByText("Fallecido")).toBeInTheDocument();

    const citas = screen.getByRole("region", { name: "Citas con tu negocio" });
    expect(within(citas).getAllByRole("row")).toHaveLength(3);
    expect(within(citas).getByText("Vacuna antirrábica")).toBeInTheDocument();

    // Otro cliente: el detalle cambia con la URL.
    await user.click(filaJorge!);
    expect(await screen.findByRole("heading", { name: "Jorge Pérez" })).toBeInTheDocument();
    expect(router.state.location.search).toBe("?cliente=21");
  });

  it("busca con espera y avisa cuando nada coincide", async () => {
    const user = userEvent.setup();
    const registro = nuevoRegistro();
    servidor.use(...base(registro, { detalles: { 20: detalleLaura() } }));
    renderRuta("/n/1/clientes?cliente=20", { usuario: usuarioDemo() });
    await screen.findByRole("list", { name: "Clientes" });

    await user.type(screen.getByLabelText("Buscar clientes"), "zz");
    expect(await screen.findByText('Ningún cliente coincide con "zz".')).toBeInTheDocument();
    // Una consulta por búsqueda, no una por tecla.
    expect(registro.listas.map((u) => u.searchParams.get("q"))).toEqual([null, "zz"]);
  });

  it("notas: escribe, edita solo las propias y borra con confirmación; recuerda la Ley 1581", async () => {
    const user = userEvent.setup();
    const registro = nuevoRegistro();
    servidor.use(...base(registro, { detalles: { 20: detalleLaura() } }));
    renderRuta("/n/1/clientes?cliente=20", { usuario: usuarioDemo() });
    const notas = await screen.findByRole("region", { name: "Notas del negocio" });
    expect(within(notas).getByText(/Ley 1581/)).toBeInTheDocument();
    expect(within(notas).getByText("Valentina Torres · 12 sep 2026, 10:15")).toBeInTheDocument();
    // La de Andrés no la edita quien consulta, pero sí la puede borrar (propietario).
    expect(within(notas).getAllByRole("button", { name: "Editar nota" })).toHaveLength(1);
    expect(within(notas).getAllByRole("button", { name: "Borrar nota" })).toHaveLength(2);

    await user.type(within(notas).getByLabelText("Nueva nota"), "Paga en efectivo");
    await user.click(within(notas).getByRole("button", { name: "Guardar nota" }));
    await waitFor(() => expect(registro.notas).toEqual([{ texto: "Paga en efectivo" }]));

    await user.click(within(notas).getByRole("button", { name: "Editar nota" }));
    const editor = within(notas).getByLabelText("Editar nota");
    await user.clear(editor);
    await user.type(editor, "Prefiere WhatsApp");
    await user.click(within(notas).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(registro.ediciones).toEqual([{ texto: "Prefiere WhatsApp" }]));

    await user.click(within(notas).getAllByRole("button", { name: "Borrar nota" })[1]!);
    const confirmar = await screen
      .findByRole("alertdialog", { name: "¿Borrar esta nota?" })
      .catch(() => screen.findByRole("dialog", { name: "¿Borrar esta nota?" }));
    expect(within(confirmar).getByText(/Se elimina definitivamente/)).toBeInTheDocument();
    await user.click(within(confirmar).getByRole("button", { name: "Borrar nota" }));
    await waitFor(() => expect(registro.borradas).toEqual(["2"]));
    expect(await screen.findByText("Nota eliminada")).toBeInTheDocument();
  });

  it("sin clientes.editar no se escriben notas; sin citas.crear no se agenda ni se registra", async () => {
    servidor.use(...base(nuevoRegistro(), { detalles: { 20: detalleLaura() } }));
    renderRuta("/n/1/clientes?cliente=20", {
      usuario: usuarioDemo({
        negocios: [
          negocioDemo({
            relacion: "empleado",
            rol: { id_rol: 5, nombre: "Consulta", permisos_json: { clientes: ["ver"] } },
          }),
        ],
      }),
    });
    const notas = await screen.findByRole("region", { name: "Notas del negocio" });
    expect(within(notas).queryByLabelText("Nueva nota")).not.toBeInTheDocument();
    expect(within(notas).queryByRole("button", { name: "Borrar nota" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Agendar cita/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cliente/ })).not.toBeInTheDocument();
  });

  it("sin clientes.ver muestra Sin permiso", async () => {
    renderRuta("/n/1/clientes", {
      usuario: usuarioDemo({
        negocios: [
          negocioDemo({
            relacion: "empleado",
            rol: { id_rol: 5, nombre: "Agenda", permisos_json: { citas: ["ver"] } },
          }),
        ],
      }),
    });
    expect(await screen.findByText("No tienes permiso para ver esta sección")).toBeInTheDocument();
  });
});

describe("C1 · Correo de un cliente sin cuenta", () => {
  it("agrega el correo y avisa la bienvenida; el 409 queda en el campo", async () => {
    const user = userEvent.setup();
    const registro = nuevoRegistro();
    servidor.use(
      ...base(registro, {
        detalles: { 21: detalleJorge() },
        correo: (email) =>
          email === "ocupado@petcat.test"
            ? fallo(409, "Ya existe una cuenta con ese correo", { email: "Ya está registrado" })
            : undefined!,
      }),
    );
    renderRuta("/n/1/clientes?cliente=21", { usuario: usuarioDemo() });
    expect(await screen.findByText(/Cliente sin cuenta\./)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Agregar correo" }));
    const d = await screen.findByRole("dialog", { name: "Agregar correo" });

    await user.type(within(d).getByLabelText("Correo"), "ocupado@petcat.test");
    await user.click(within(d).getByRole("button", { name: "Agregar y enviar bienvenida" }));
    expect(await within(d).findByText("Ya existe una cuenta con ese correo")).toBeInTheDocument();

    await user.clear(within(d).getByLabelText("Correo"));
    await user.type(within(d).getByLabelText("Correo"), "Jorge@Petcat.test");
    await user.click(within(d).getByRole("button", { name: "Agregar y enviar bienvenida" }));
    expect(
      await screen.findByText("Correo agregado. Le enviamos la bienvenida para que active su cuenta"),
    ).toBeInTheDocument();
    expect(registro.correos).toEqual([{ email: "ocupado@petcat.test" }, { email: "jorge@petcat.test" }]);
    // El aviso sale del hook al guardar; el diálogo se cierra cuando se recarga el cliente.
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Agregar correo" })).not.toBeInTheDocument());
  });

  it("registrado aquí sin activar: corrige el correo o reenvía la bienvenida al mismo", async () => {
    const user = userEvent.setup();
    const registro = nuevoRegistro();
    servidor.use(
      ...base(registro, {
        detalles: { 21: detalleJorge({ email: "jorje@petcat.test" }) },
        correo: (email) =>
          ok({
            cliente: { id_usuario: 21, nombre: "Jorge", apellido: "Pérez", email, telefono: null },
            accion: email === "jorje@petcat.test" ? "reenviado" : "corregido",
          }),
      }),
    );
    renderRuta("/n/1/clientes?cliente=21", { usuario: usuarioDemo() });
    expect(await screen.findByText(/Aún no activa su cuenta/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reenviar bienvenida" }));
    expect(await screen.findByText("Le reenviamos la bienvenida")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Corregir correo" }));
    const d = await screen.findByRole("dialog", { name: "Corregir correo" });
    expect(within(d).getByText(/el enlace que fue a jorje@petcat.test dejará de servir/)).toBeInTheDocument();
    const campo = within(d).getByLabelText("Correo");
    expect(campo).toHaveValue("jorje@petcat.test");
    await user.clear(campo);
    await user.type(campo, "jorge@petcat.test");
    await user.click(within(d).getByRole("button", { name: "Corregir y enviar" }));
    expect(
      await screen.findByText(
        "Correo corregido. Le enviamos una bienvenida nueva; el enlace anterior ya no sirve",
      ),
    ).toBeInTheDocument();
    expect(registro.correos).toEqual([{ email: "jorje@petcat.test" }, { email: "jorge@petcat.test" }]);
  });

  it("con la cuenta activada (correo_editable falso) no se ofrece cambiar el correo", async () => {
    servidor.use(...base(nuevoRegistro(), { detalles: { 20: detalleLaura() } }));
    renderRuta("/n/1/clientes?cliente=20", { usuario: usuarioDemo() });
    await screen.findByRole("heading", { name: "Laura Gómez" });
    expect(screen.queryByRole("button", { name: /correo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reenviar bienvenida" })).not.toBeInTheDocument();
  });
});

describe("C1 · Agendar cita y búsqueda del Topbar", () => {
  it("Agendar cita abre B5 en la agenda con el cliente y su única mascota viva elegidos", async () => {
    const user = userEvent.setup();
    servidor.use(
      ...base(nuevoRegistro(), { detalles: { 20: detalleLaura() } }),
      http.get(`${API}/negocios/1/citas`, () => ok([])),
      http.get(`${API}/negocios/1/profesionales`, () => ok([profesionalDemo()])),
      http.get(`${API}/negocios/1/gestion`, () => ok(gestionDemo({ sucursales: [sedeDemo()] }))),
      http.get(`${API}/negocios/1/servicios`, () => pagina([])),
    );
    const { router } = renderRuta("/n/1/clientes?cliente=20", { usuario: usuarioDemo() });
    await user.click(await screen.findByRole("button", { name: /Agendar cita/ }));

    const d = await screen.findByRole("dialog", { name: "Nueva cita" });
    expect(router.state.location.pathname).toBe("/n/1/agenda");
    expect(within(d).getByText("Laura Gómez")).toBeInTheDocument();
    // Rocky está fallecido: solo Max, ya elegido.
    expect(within(d).getByRole("radio", { name: "Max" })).toHaveAttribute("aria-checked", "true");
    expect(within(d).queryByRole("radio", { name: "Rocky" })).not.toBeInTheDocument();
    // El estado de la navegación se borra: volver o recargar no abre B5 otra vez.
    await waitFor(() => expect(router.state.location.state).toBeNull());
  });

  it("la búsqueda del Topbar encuentra clientes y abre su detalle", async () => {
    const user = userEvent.setup();
    servidor.use(
      ...base(nuevoRegistro(), {
        detalles: {
          20: detalleLaura(),
          22: clienteDetalleDemo({ cliente: { id_usuario: 22, nombre: "Luis", apellido: "Díaz" } }),
        },
      }),
      http.get(`${API}/negocios/1/citas`, () => ok([])),
      http.get(`${API}/negocios/1/profesionales`, () => ok([])),
      http.get(`${API}/negocios/1/gestion`, () => ok(gestionDemo())),
    );
    const { router } = renderRuta("/n/1/agenda", { usuario: usuarioDemo() });
    await user.type(await screen.findByRole("combobox", { name: "Buscar cliente o mascota" }), "luis");
    const resultados = await screen.findByRole("list", { name: "Resultados de la búsqueda" });
    await user.click(within(resultados).getByRole("button", { name: /Luis Díaz/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/n/1/clientes"));
    expect(router.state.location.search).toBe("?cliente=22");
    expect(await screen.findByRole("heading", { name: "Luis Díaz" })).toBeInTheDocument();
  });
});
