import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import type { CitaPanel } from "@/api/citas";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { diasDeSemana, sumarDias } from "@/lib/agenda";
import { hoyISO } from "@/lib/format";
import { useUi } from "@/stores/ui";
import { citaPanelDemo, horarioPartido, profesionalDemo } from "@/test/agenda";
import { gestionDemo, negocioDemo, renderRuta, sedeDemo, usuarioDemo } from "@/test/render";
import { citaAfectadaDemo } from "@/test/servicios";
import { API, http, ok, servidor } from "@/test/servidor";

const HOY = hoyISO();
const [LUNES, , MIERCOLES] = diasDeSemana(HOY) as [string, string, string];
const MANANA = sumarDias(HOY, 1);

const carlos = profesionalDemo();
const paula = profesionalDemo({
  id_empleado: 2,
  nombre: "Paula",
  apellido: "Rojas",
  especialidad: "Cirugía",
});
const ana = profesionalDemo({
  id_empleado: 3,
  nombre: "Ana",
  apellido: "Rodríguez",
  especialidad: null,
  servicios: [],
});

const max = citaPanelDemo({ id_cita: 1, fecha: LUNES, hora_inicio: "08:00", hora_fin: "08:30" });
const nina = citaPanelDemo({
  id_cita: 2,
  fecha: LUNES,
  hora_inicio: "08:00",
  hora_fin: "08:15",
  empleado: { id_empleado: 2, nombre: "Paula", apellido: "Rojas" },
  mascota: { id_mascota: 5, nombre: "Nina", especie: "gato" },
  servicio: { id_servicio: 2, nombre: "Vacuna antirrábica", duracion_minutos: 15 },
});
const pendiente = citaPanelDemo({
  id_cita: 3,
  fecha: MANANA,
  hora_inicio: "09:30",
  hora_fin: "09:45",
  estado: "pendiente",
  confirmar_antes_de: `${MANANA} 08:30:00`,
  mascota: { id_mascota: 6, nombre: "Luna", especie: "gato" },
});
const fuera = citaPanelDemo({
  id_cita: 4,
  fecha: sumarDias(HOY, 10),
  hora_inicio: "15:30",
  hora_fin: "16:00",
  empleado: { id_empleado: 2, nombre: "Paula", apellido: "Rojas" },
  mascota: { id_mascota: 7, nombre: "Milo", especie: "perro" },
  fuera_de_disponibilidad: true,
  motivo_fuera: { tipo: "bloqueo", motivo: "Cita médica personal" },
});

interface Opciones {
  agenda?: CitaPanel[];
  peticiones?: URL[];
}

const base = ({ agenda = [max, nina], peticiones = [] }: Opciones = {}) => [
  http.get(`${API}/negocios/1/citas`, ({ request }) => {
    peticiones.push(new URL(request.url));
    return ok(agenda);
  }),
  http.get(`${API}/negocios/1/citas/atencion`, () =>
    ok({ por_confirmar: [pendiente], fuera_de_disponibilidad: [fuera] }),
  ),
  http.get(`${API}/negocios/1/profesionales`, () => ok([ana, carlos, paula])),
  http.get(`${API}/negocios/1/gestion`, () =>
    ok(gestionDemo({ sucursales: [sedeDemo({ horarios: horarioPartido })] })),
  ),
];

beforeEach(() => __reiniciarSesionParaPruebas());

describe("B3 · Agenda semanal", () => {
  it("pide la semana de lunes a domingo y muestra las citas, lo cerrado y el panel lateral", async () => {
    const peticiones: URL[] = [];
    servidor.use(...base({ peticiones }));
    renderRuta("/n/1/agenda", { usuario: usuarioDemo() });

    expect(
      await screen.findByRole("button", { name: /08:00–08:30 · Max · Consulta general/ }),
    ).toBeInTheDocument();
    // Las dos citas de las 08:00 (de distinto profesional) van lado a lado.
    const deMax = screen.getByRole("button", { name: /· Max ·/ });
    const deNina = screen.getByRole("button", { name: /· Nina ·/ });
    expect(deMax.style.width).toBe("calc(50% - 6px)");
    expect(deNina.style.left).toBe("calc(50% + 3px)");

    const semana = diasDeSemana(HOY);
    expect(peticiones[0]!.searchParams.get("desde")).toBe(semana[0]);
    expect(peticiones[0]!.searchParams.get("hasta")).toBe(semana[6]);
    expect(screen.getByText("Sede Centro · 2 citas esta semana")).toBeInTheDocument();

    // Horario partido sombreado; el domingo (cerrado y sin citas) no se muestra.
    expect(screen.getAllByText("Cerrado 12:00–14:00").length).toBeGreaterThan(0);
    expect(screen.queryByRole("group", { name: /^Domingo/ })).not.toBeInTheDocument();

    const porConfirmar = screen.getByRole("list", { name: "Citas por confirmar" });
    expect(within(porConfirmar).getByText("Luna · Consulta general")).toBeInTheDocument();
    expect(within(porConfirmar).getByText(/^Se cancela sola en|^Se cancela en breve/)).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Citas fuera de disponibilidad" })).getByText(
        "Paula tiene un bloqueo: Cita médica personal.",
      ),
    ).toBeInTheDocument();
    // El menú muestra cuántas hay por confirmar.
    expect(within(screen.getByRole("navigation")).getByLabelText("1 por confirmar")).toBeInTheDocument();
  });

  it("los filtros quedan en la URL y llegan a la API", async () => {
    const user = userEvent.setup();
    const peticiones: URL[] = [];
    servidor.use(...base({ peticiones }));
    const { router } = renderRuta("/n/1/agenda", {
      usuario: usuarioDemo({ negocios: [negocioDemo({ id_empleado: 1 })] }),
    });
    await screen.findByRole("button", { name: /· Max ·/ });

    await user.click(screen.getByRole("combobox", { name: "Profesional" }));
    await user.click(await screen.findByRole("option", { name: "Paula Rojas" }));
    await waitFor(() => expect(peticiones.at(-1)!.searchParams.get("id_empleado")).toBe("2"));
    expect(router.state.location.search).toContain("profesional=2");

    await user.click(screen.getByRole("button", { name: "Estados: Todos los estados" }));
    await user.click(await screen.findByRole("checkbox", { name: "Pendientes" }));
    await waitFor(() => expect(peticiones.at(-1)!.searchParams.get("estado")).toBe("pendiente"));
    await user.keyboard("{Escape}");

    // "Solo mis citas" reemplaza al profesional elegido.
    await user.click(screen.getByRole("switch"));
    await waitFor(() => expect(peticiones.at(-1)!.searchParams.get("solo_mias")).toBe("true"));
    expect(peticiones.at(-1)!.searchParams.get("id_empleado")).toBeNull();

    // Semana siguiente.
    await user.click(screen.getByRole("button", { name: "Semana siguiente" }));
    await waitFor(() => expect(peticiones.at(-1)!.searchParams.get("desde")).toBe(sumarDias(LUNES, 7)));
  });

  it("elegir una cita la deja en la URL y la resalta", async () => {
    const user = userEvent.setup();
    servidor.use(...base());
    const { router } = renderRuta("/n/1/agenda", { usuario: usuarioDemo() });
    await user.click(await screen.findByRole("button", { name: /· Max ·/ }));
    expect(router.state.location.search).toContain("cita=1");
    expect(screen.getByRole("button", { name: /· Max ·/ })).toHaveAttribute("aria-pressed", "true");

    // Una cita de otra semana (desde el panel) lleva a su fecha.
    await user.click(screen.getByRole("button", { name: /Milo ·/ }));
    expect(router.state.location.search).toContain(`fecha=${fuera.fecha}`);
    expect(router.state.location.search).toContain("cita=4");
  });

  it("sin citas.ver muestra el estado sin permiso", async () => {
    renderRuta("/n/1/agenda", {
      usuario: usuarioDemo({
        negocios: [
          negocioDemo({
            relacion: "empleado",
            rol: { id_rol: 9, nombre: "Bodega", permisos_json: { inventario: ["ver"] } },
          }),
        ],
      }),
    });
    expect(await screen.findByText("No tienes permiso para ver esta sección")).toBeInTheDocument();
  });
});

describe("B9 · Día por profesional", () => {
  it("una columna por profesional que atiende servicios, con su disponibilidad y sus bloqueos", async () => {
    servidor.use(
      ...base({ agenda: [max, nina] }),
      http.get(`${API}/empleados/:id/disponibilidad-efectiva`, ({ params }) =>
        ok({
          fecha: LUNES,
          dia_semana: 1,
          sigue_horario_sucursal: true,
          sucursales: [
            {
              id_sucursal: 3,
              nombre: "Sede Centro",
              rangos:
                params.id === "2"
                  ? [{ hora_inicio: "08:00", hora_fin: "12:00" }]
                  : [
                      { hora_inicio: "08:00", hora_fin: "12:00" },
                      { hora_inicio: "14:00", hora_fin: "18:00" },
                    ],
            },
          ],
        }),
      ),
      http.get(`${API}/empleados/:id/disponibilidad`, ({ params }) =>
        ok({
          horario_semanal: [],
          sigue_horario_sucursal: true,
          excepciones:
            params.id === "2"
              ? [
                  {
                    id_disponibilidad: 50,
                    id_empleado: 2,
                    tipo: "bloqueo",
                    fecha_especifica: LUNES,
                    fecha_fin: null,
                    hora_inicio: "14:00",
                    hora_fin: "18:00",
                    id_sucursal: null,
                    motivo: "Cita médica personal",
                  },
                ]
              : [],
        }),
      ),
    );
    renderRuta(`/n/1/agenda?vista=dia&fecha=${LUNES}`, { usuario: usuarioDemo() });

    const columnaPaula = await screen.findByRole("group", { name: "Paula Rojas" });
    expect(screen.getByRole("group", { name: "Carlos Pérez" })).toBeInTheDocument();
    // Ana no atiende servicios: no tiene columna.
    expect(screen.queryByRole("group", { name: "Ana Rodríguez" })).not.toBeInTheDocument();
    expect(within(columnaPaula).getByRole("button", { name: /· Nina ·/ })).toBeInTheDocument();
    expect(
      await within(columnaPaula).findByText("Bloqueo 14:00–18:00 · Cita médica personal"),
    ).toBeInTheDocument();
    // Lo que tapa el bloqueo no se marca además como cerrado.
    expect(within(columnaPaula).queryByText("Cerrado desde las 12:00")).not.toBeInTheDocument();
    expect(within(columnaPaula).getByText("Cerrado 12:00–14:00")).toBeInTheDocument();
  });
});

describe("B10 · Lista", () => {
  it("agrupa por día con hoy primero y muestra el plazo de las pendientes", async () => {
    const hoyCita = citaPanelDemo({ id_cita: 10, fecha: HOY, hora_inicio: "10:00", hora_fin: "10:30" });
    servidor.use(...base({ agenda: [hoyCita, pendiente] }));
    renderRuta("/n/1/agenda?vista=lista", { usuario: usuarioDemo() });

    const encabezados = await screen.findAllByRole("heading", { level: 3 });
    expect(encabezados[0]).toHaveTextContent(/· HOY · 1 CITA$/);
    expect(screen.getByText(/^Pendiente · /)).toBeInTheDocument();
  });

  it("con fuera=1 muestra las citas fuera de disponibilidad de la atención, sin rango", async () => {
    const user = userEvent.setup();
    servidor.use(...base({ agenda: [] }));
    const { router } = renderRuta("/n/1/agenda?vista=lista&fuera=1", { usuario: usuarioDemo() });

    expect(await screen.findByText("Citas fuera de disponibilidad, desde hoy")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Milo · Consulta general/ })).toBeInTheDocument();
    expect(screen.getByText("Fuera de disponibilidad", { selector: "span" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver la semana" }));
    expect(router.state.location.search).not.toContain("fuera");
    expect(await screen.findByText("No hay citas en esta semana")).toBeInTheDocument();
  });
});

describe("Citas afectadas → agenda", () => {
  it("«Ver en la agenda» lleva a la Lista de citas fuera de disponibilidad", async () => {
    const user = userEvent.setup();
    servidor.use(...base());
    const { router } = renderRuta(`/n/1/agenda?fecha=${MIERCOLES}`, { usuario: usuarioDemo() });
    await screen.findByRole("button", { name: /· Max ·/ });

    act(() => useUi.getState().mostrarCitasAfectadas([citaAfectadaDemo()], "El horario se guardó"));
    await user.click(await screen.findByRole("button", { name: "Ver en la agenda" }));
    expect(router.state.location.pathname).toBe("/n/1/agenda");
    expect(router.state.location.search).toBe("?vista=lista&fuera=1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
