import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { CambioAgenda } from "@/api/citas";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { diasDeSemana } from "@/lib/agenda";
import { hoyISO } from "@/lib/format";
import { citaDetalleDemo, citaPanelDemo, horarioPartido, profesionalDemo } from "@/test/agenda";
import { gestionDemo, negocioDemo, renderRuta, sedeDemo, usuarioDemo } from "@/test/render";
import { API, http, ok, servidor } from "@/test/servidor";
import { socketFalso } from "@/test/socketFalso";

const [LUNES] = diasDeSemana(hoyISO()) as [string];
const max = citaPanelDemo({ id_cita: 1, fecha: LUNES, hora_inicio: "08:00", hora_fin: "08:30" });

/** Cuenta las peticiones de la agenda (GET /negocios/1/citas) y de la atención. */
const base = (contador = { agenda: 0, atencion: 0 }) => [
  http.get(`${API}/negocios/1/citas`, () => {
    contador.agenda += 1;
    return ok([max]);
  }),
  http.get(`${API}/negocios/1/citas/atencion`, () => {
    contador.atencion += 1;
    return ok({ por_confirmar: [], fuera_de_disponibilidad: [] });
  }),
  http.get(`${API}/negocios/1/profesionales`, () => ok([profesionalDemo()])),
  http.get(`${API}/negocios/1/gestion`, () => ok(gestionDemo({ sucursales: [sedeDemo({ horarios: horarioPartido })] }))),
  // Sin configuracion.ver, las sedes salen del perfil público.
  http.get(`${API}/negocios/1`, () => ok({ sucursales: [sedeDemo({ horarios: horarioPartido })] })),
  http.get(`${API}/citas/10`, () => ok(citaDetalleDemo({ id_cita: 10, fecha: LUNES, estado: "pendiente" }))),
  http.get(`${API}/citas/10/historial`, () => ok([])),
];

const reserva = (cambios: Partial<CambioAgenda> = {}): CambioAgenda => ({
  id_negocio: 1,
  accion: "reserva_app",
  id_cita: 10,
  fechas: [LUNES],
  por: 99,
  cita: { mascota: "Toby", servicio: "Consulta general", fecha: LUNES, hora_inicio: "10:00", estado: "pendiente" },
  ...cambios,
});

const abrirAgenda = async (usuario = usuarioDemo()) => {
  const contador = { agenda: 0, atencion: 0 };
  servidor.use(...base(contador));
  const vista = renderRuta("/n/1/agenda", { usuario });
  await screen.findAllByText(max.mascota.nombre);
  const socket = socketFalso();
  socket.conectar();
  return { ...vista, socket, contador };
};

beforeEach(() => __reiniciarSesionParaPruebas());

describe("Agenda en tiempo real", () => {
  it("abre una conexión de la sesión, que se autentica con el access token vigente", async () => {
    const { socket } = await abrirAgenda();
    expect(socket.opciones).toMatchObject({ path: "/socket.io", transports: ["websocket"] });
    let enviado: unknown;
    (socket.opciones.auth as (cb: (d: unknown) => void) => void)((d) => (enviado = d));
    expect(enviado).toEqual({ token: null });
  });

  it("agenda_actualizada recarga la agenda y la atención; un cambio de otro negocio no recarga esta", async () => {
    const { socket, contador } = await abrirAgenda();
    const antes = { ...contador };

    socket.recibir("agenda_actualizada", { id_negocio: 1, accion: "estado", id_cita: 1, estado: "confirmada", fechas: [LUNES], por: 2 });
    await waitFor(() => expect(contador.agenda).toBe(antes.agenda + 1));
    expect(contador.atencion).toBeGreaterThan(antes.atencion);

    const despues = contador.agenda;
    socket.recibir("agenda_actualizada", { id_negocio: 7, accion: "estado", id_cita: 50, fechas: [LUNES], por: 3 });
    await new Promise((r) => setTimeout(r, 100));
    expect(contador.agenda).toBe(despues);
    // El cambio que hizo el mismo usuario recarga igual, pero no avisa.
    expect(screen.queryByText("Nueva reserva desde la app")).not.toBeInTheDocument();
  });

  it("una notificación de cita (cita_*) también recarga; las demás no", async () => {
    const { socket, contador } = await abrirAgenda();
    const antes = contador.agenda;
    socket.recibir("notificacion", { tipo: "plan_limite_80", datos: { id_negocio: 1 } });
    await new Promise((r) => setTimeout(r, 100));
    expect(contador.agenda).toBe(antes);
    socket.recibir("notificacion", { tipo: "cita_cancelada", datos: { id_negocio: 1, id_cita: 1 } });
    await waitFor(() => expect(contador.agenda).toBe(antes + 1));
  });

  it("una reserva desde la app se avisa con Ver, que abre el detalle de la cita", async () => {
    const usuario = userEvent.setup();
    const { socket, router } = await abrirAgenda();
    socket.recibir("agenda_actualizada", reserva());

    expect(await screen.findByText("Nueva reserva desde la app")).toBeInTheDocument();
    expect(screen.getByText(/Toby · Consulta general · .*10:00/)).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Ver" }));

    await waitFor(() => expect(router.state.location.search).toContain("cita=10"));
    expect(router.state.location.search).toContain(`fecha=${LUNES}`);
    expect(await screen.findByRole("dialog", { name: /Toby|Max|Cita/ })).toBeInTheDocument();
  });

  it("no avisa la reserva hecha por el propio usuario, la de otro negocio ni otros cambios", async () => {
    const { socket } = await abrirAgenda();
    socket.recibir("agenda_actualizada", reserva({ por: 2 }));
    socket.recibir("agenda_actualizada", reserva({ id_negocio: 7 }));
    socket.recibir("agenda_actualizada", reserva({ accion: "creada", cita: undefined }));
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByText("Nueva reserva desde la app")).not.toBeInTheDocument();
  });

  it("no avisa a un rol sin citas.editar", async () => {
    const soloVer = usuarioDemo({
      negocios: [
        negocioDemo({
          relacion: "empleado",
          rol: { id_rol: 2, nombre: "Veterinario", permisos_json: { citas: ["ver"] } },
        }),
      ],
    });
    const otra = await abrirAgenda(soloVer);
    otra.socket.recibir("agenda_actualizada", reserva());
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByText("Nueva reserva desde la app")).not.toBeInTheDocument();
  });

  it("sin conexión muestra el aviso discreto; al reconectar lo quita y recarga lo que se pudo perder", async () => {
    const { socket, contador } = await abrirAgenda();
    expect(screen.queryByText(/Sin actualización en tiempo real/)).not.toBeInTheDocument();

    socket.perderConexion();
    expect(await screen.findByRole("status")).toHaveTextContent("Sin actualización en tiempo real · reintentando");

    const antes = contador.agenda;
    socket.conectar();
    await waitFor(() => expect(screen.queryByText(/Sin actualización en tiempo real/)).not.toBeInTheDocument());
    await waitFor(() => expect(contador.agenda).toBe(antes + 1));
  });
});
