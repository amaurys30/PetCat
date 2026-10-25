import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import type { CitaPanelDetalle } from "@/api/citas";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { sumarDias } from "@/lib/agenda";
import { hoyISO } from "@/lib/format";
import { useUi } from "@/stores/ui";
import { cambioDemo, citaDetalleDemo, citaPanelDemo, horarioPartido, profesionalDemo } from "@/test/agenda";
import { gestionDemo, negocioDemo, renderRuta, sedeDemo, usuarioDemo } from "@/test/render";
import { resumenDemo } from "@/test/salud";
import { citaAfectadaDemo } from "@/test/servicios";
import { API, fallo, http, HttpResponse, ok, servidor } from "@/test/servidor";

const HOY = hoyISO();
const AYER = sumarDias(HOY, -1);
const MANANA = sumarDias(HOY, 1);

const pendiente = citaDetalleDemo({
  id_cita: 1042,
  fecha: MANANA,
  hora_inicio: "09:30",
  hora_fin: "09:45",
  estado: "pendiente",
  confirmar_antes_de: `${MANANA} 08:30:00`,
  mascota: { id_mascota: 6, nombre: "Luna", especie: "gato" },
});
// Confirmada de ayer: ya empezó (se puede completar directo).
const empezada = citaDetalleDemo({ id_cita: 7, fecha: AYER, estado: "confirmada", precio_estimado: 45000 });

interface Peticion {
  metodo: string;
  ruta: string;
  cuerpo: unknown;
}

/** Agenda vacía, la cita, su historial, sedes y profesionales; registra lo que se envía. */
function api(citas: CitaPanelDetalle[], peticiones: Peticion[] = []) {
  const porId = new Map(citas.map((c) => [c.id_cita, c]));
  const registrar = async (request: Request) => {
    const url = new URL(request.url);
    peticiones.push({
      metodo: request.method,
      ruta: url.pathname.replace("/api/v1", "") + url.search,
      cuerpo: request.method === "GET" ? null : await request.json().catch(() => null),
    });
  };
  return [
    http.get(`${API}/negocios/1/citas`, () => ok([])),
    http.get(`${API}/negocios/1/profesionales`, () =>
      ok([profesionalDemo(), profesionalDemo({ id_empleado: 2, nombre: "Paula", apellido: "Rojas" })]),
    ),
    http.get(`${API}/negocios/1/gestion`, () =>
      ok(gestionDemo({ sucursales: [sedeDemo({ horarios: horarioPartido })] })),
    ),
    http.get(`${API}/citas/:id/historial`, () =>
      ok([
        cambioDemo(),
        cambioDemo({
          fecha_cambio: "2026-10-05 10:00:00",
          valor_anterior: "pendiente",
          valor_nuevo: "confirmada",
          motivo: null,
          realizado_por: "negocio",
          usuario: { id_usuario: 2, nombre: "Laura", apellido: "Martínez" },
        }),
      ]),
    ),
    http.get(`${API}/citas/:id`, ({ params }) => {
      const cita = porId.get(Number(params.id));
      return cita ? ok(cita) : fallo(404, "Cita no encontrada");
    }),
    http.all(`${API}/citas/*`, async ({ request }) => {
      await registrar(request);
      return undefined;
    }),
    http.all(`${API}/negocios/1/citas/horarios-libres`, async ({ request }) => {
      await registrar(request);
      return undefined;
    }),
  ];
}

beforeEach(() => __reiniciarSesionParaPruebas());

describe("B4 · Detalle de la cita", () => {
  it("muestra el plazo, la mascota con su alergia, el cliente con su cumplimiento y el historial; confirma", async () => {
    const user = userEvent.setup();
    const peticiones: Peticion[] = [];
    servidor.use(
      http.patch(`${API}/citas/1042/estado`, () =>
        ok({ ...pendiente, estado: "confirmada", confirmar_antes_de: null }),
      ),
      ...api([pendiente], peticiones),
    );
    renderRuta(`/n/1/agenda?cita=1042&fecha=${MANANA}`, { usuario: usuarioDemo() });

    const panel = await screen.findByRole("dialog", { name: "Cita #1042" });
    expect(
      await within(panel).findByText(/^Confírmala antes del .* o se cancelará sola\.$/),
    ).toBeInTheDocument();
    expect(within(panel).getByText("Reservada desde la app")).toBeInTheDocument();

    const mascota = within(panel).getByRole("region", { name: "Mascota" });
    expect(mascota).toHaveTextContent("Luna");
    expect(mascota).toHaveTextContent("Gato · Criolla · 3 años · 4,2 kg");
    expect(mascota).toHaveTextContent("Alergia: Penicilina");

    const cliente = within(panel).getByRole("region", { name: "Cliente" });
    expect(within(cliente).getByRole("link", { name: "sofia@petcat.test" })).toHaveAttribute(
      "href",
      "mailto:sofia@petcat.test",
    );
    expect(cliente).toHaveTextContent("Usa la app");
    expect(cliente).toHaveTextContent("12 completadas");
    expect(cliente).toHaveTextContent("1 inasistencia");
    expect(cliente).toHaveTextContent("0 cancelaciones tardías");

    const historial = within(panel).getByRole("region", { name: "Historial de la cita" });
    expect(await within(historial).findByText("Creada desde la app · pendiente")).toBeInTheDocument();
    expect(within(historial).getByText(/Laura Martínez/)).toBeInTheDocument();
    expect(within(historial).getByText(/^Plazo para confirmar:/)).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText(/^Cita de .+ confirmada$/)).toBeInTheDocument();
  });

  it("guarda las notas internas solo si cambiaron", async () => {
    const user = userEvent.setup();
    const peticiones: Peticion[] = [];
    servidor.use(
      http.patch(`${API}/citas/1042`, () => ok({ ...pendiente, notas_internas: "Traer el carnet" })),
      ...api([pendiente], peticiones),
    );
    renderRuta(`/n/1/agenda?cita=1042&fecha=${MANANA}`, { usuario: usuarioDemo() });
    const notas = await screen.findByLabelText("Notas internas (no las ve el cliente)");
    expect(screen.queryByRole("button", { name: "Guardar notas" })).not.toBeInTheDocument();
    await user.type(notas, "Traer el carnet");
    await user.click(screen.getByRole("button", { name: "Guardar notas" }));
    expect(await screen.findByText("Notas guardadas")).toBeInTheDocument();
  });
});

describe("B8 · Completar", () => {
  it("desde confirmada pasa por en curso y completa con el precio final; si la segunda falla, reintenta solo completar", async () => {
    const user = userEvent.setup();
    const llamadas: unknown[] = [];
    let actual = empezada;
    let fallar = true;
    servidor.use(
      http.patch(`${API}/citas/7/estado`, async ({ request }) => {
        const cuerpo = (await request.json()) as { estado: string };
        llamadas.push(cuerpo);
        if (cuerpo.estado === "en_curso") {
          actual = { ...actual, estado: "en_curso" };
          return ok(actual);
        }
        if (fallar) {
          fallar = false;
          return fallo(409, "No se pudo completar la cita");
        }
        actual = { ...actual, estado: "completada" };
        return ok(actual);
      }),
      http.get(`${API}/citas/7`, () => ok(actual)),
      ...api([empezada]),
    );
    renderRuta(`/n/1/agenda?cita=7&fecha=${AYER}`, { usuario: usuarioDemo() });

    const panel = await screen.findByRole("dialog", { name: "Cita #7" });
    expect(await within(panel).findByRole("button", { name: "Iniciar atención" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "No asistió" })).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "Completar" }));

    const dialogo = await screen.findByRole("dialog", { name: "Completar cita" });
    const precio = within(dialogo).getByLabelText("Precio final (COP) *");
    expect(precio).toHaveValue("45.000");
    await user.clear(precio);
    await user.type(precio, "52000");
    await user.click(within(dialogo).getByRole("button", { name: "Completar cita" }));

    expect(
      await within(dialogo).findByText(/La cita quedó en curso, pero no se pudo completar/),
    ).toBeInTheDocument();
    expect(llamadas).toEqual([{ estado: "en_curso" }, { estado: "completada", precio_final: 52000 }]);

    await user.click(within(dialogo).getByRole("button", { name: "Completar cita" }));
    expect(await screen.findByText("Cita completada")).toBeInTheDocument();
    expect(llamadas.slice(2)).toEqual([{ estado: "completada", precio_final: 52000 }]);
  });
});

describe("B6 · Cancelar y rechazar", () => {
  it("el motivo es obligatorio y se envía; desde el panel lateral, Rechazar abre el mismo diálogo", async () => {
    const user = userEvent.setup();
    let cuerpo: unknown = null;
    servidor.use(
      http.get(`${API}/negocios/1/citas/atencion`, () =>
        ok({ por_confirmar: [pendiente], fuera_de_disponibilidad: [] }),
      ),
      http.post(`${API}/citas/1042/cancelar`, async ({ request }) => {
        cuerpo = await request.json();
        return ok({ ...pendiente, estado: "cancelada" });
      }),
      ...api([pendiente]),
    );
    renderRuta("/n/1/agenda", { usuario: usuarioDemo() });

    const tarjetas = await screen.findByRole("list", { name: "Citas por confirmar" });
    await user.click(within(tarjetas).getByRole("button", { name: "Rechazar" }));
    const dialogo = await screen.findByRole("dialog", { name: "Rechazar cita" });
    await user.click(within(dialogo).getByRole("button", { name: "Rechazar cita" }));
    expect(within(dialogo).getByText("Escribe el motivo")).toBeInTheDocument();
    expect(cuerpo).toBeNull();

    await user.type(within(dialogo).getByRole("textbox"), "No hay veterinario ese día");
    await user.click(within(dialogo).getByRole("button", { name: "Rechazar cita" }));
    expect(await screen.findByText("Cita rechazada")).toBeInTheDocument();
    expect(cuerpo).toEqual({ motivo: "No hay veterinario ese día" });
  });
});

describe("B7 · Reprogramar", () => {
  it("pide horarios sin contar la propia cita; un 409 recarga los horarios; al terminar abre la cita nueva", async () => {
    const user = userEvent.setup();
    const consultas: URL[] = [];
    let ocupado = true;
    const confirmada = citaDetalleDemo({ id_cita: 30, fecha: MANANA, estado: "confirmada" });
    servidor.use(
      http.get(`${API}/negocios/1/citas/horarios-libres`, ({ request }) => {
        consultas.push(new URL(request.url));
        return ok({
          fecha: MANANA,
          servicio: {
            id_servicio: 1,
            nombre: "Consulta general",
            duracion_minutos: 30,
            precio_actual: 60000,
          },
          sucursal: { id_sucursal: 3, nombre: "Sede Centro" },
          horarios: [
            { hora_inicio: "10:00", hora_fin: "10:30", empleados: [] },
            { hora_inicio: "10:30", hora_fin: "11:00", empleados: [] },
          ],
          motivo_sin_horarios: null,
        });
      }),
      http.post(`${API}/citas/30/reprogramar`, () => {
        if (ocupado) {
          ocupado = false;
          return fallo(409, "El horario ya no está disponible: elige otro");
        }
        return HttpResponse.json(
          {
            success: true,
            message: "Cita reprogramada",
            data: { ...confirmada, id_cita: 31, hora_inicio: "10:30" },
          },
          { status: 201 },
        );
      }),
      ...api([confirmada]),
    );
    const { router } = renderRuta(`/n/1/agenda?cita=30&fecha=${MANANA}`, { usuario: usuarioDemo() });

    const panel = await screen.findByRole("dialog", { name: "Cita #30" });
    await user.click(await within(panel).findByRole("button", { name: "Reprogramar" }));
    const dialogo = await screen.findByRole("dialog", { name: "Reprogramar cita" });
    await user.click(await within(dialogo).findByRole("radio", { name: "10:00" }));
    expect(consultas[0]!.searchParams.get("id_cita_excluir")).toBe("30");
    expect(consultas[0]!.searchParams.get("fecha")).toBe(MANANA);

    await user.click(within(dialogo).getByRole("button", { name: /^Reprogramar a / }));
    expect(
      await within(dialogo).findByText("El horario ya no está disponible: elige otro"),
    ).toBeInTheDocument();
    await waitFor(() => expect(consultas.length).toBeGreaterThanOrEqual(2));

    await user.click(within(dialogo).getByRole("radio", { name: "10:30" }));
    await user.click(within(dialogo).getByRole("button", { name: /^Reprogramar a .*10:30$/ }));
    await waitFor(() => expect(router.state.location.search).toContain("cita=31"));
    expect(await screen.findByText(/^Cita reprogramada:/)).toBeInTheDocument();
  });
});

describe("Reasignar", () => {
  it("desde las citas afectadas: solo los libres se pueden elegir; al reasignar sale de la lista", async () => {
    const user = userEvent.setup();
    let cuerpo: unknown = null;
    const fuera = citaDetalleDemo({ id_cita: 30, fecha: MANANA, fuera_de_disponibilidad: true });
    servidor.use(
      http.get(`${API}/citas/30/profesionales-libres`, () =>
        ok({
          id_cita: 30,
          fecha: MANANA,
          hora_inicio: "09:00",
          hora_fin: "09:30",
          profesionales: [
            {
              id_empleado: 1,
              nombre: "Carlos",
              apellido: "Pérez",
              actual: true,
              libre: false,
              motivo: "No está disponible a esa hora (horario, bloqueo o vacaciones)",
            },
            { id_empleado: 2, nombre: "Paula", apellido: "Rojas", actual: false, libre: true, motivo: null },
            {
              id_empleado: 3,
              nombre: "Ana",
              apellido: "Ruiz",
              actual: false,
              libre: false,
              motivo: "Tiene otra cita a esa hora",
            },
          ],
        }),
      ),
      http.patch(`${API}/citas/30`, async ({ request }) => {
        cuerpo = await request.json();
        return ok({ ...fuera, empleado: { id_empleado: 2, nombre: "Paula", apellido: "Rojas" } });
      }),
      ...api([fuera]),
    );
    renderRuta("/n/1/agenda", { usuario: usuarioDemo() });
    await screen.findByText(/citas? esta semana/);
    act(() =>
      useUi
        .getState()
        .mostrarCitasAfectadas(
          [citaAfectadaDemo({ id_cita: 30 }), citaAfectadaDemo({ id_cita: 31 })],
          "El horario se guardó",
        ),
    );

    await user.click(
      await screen.findAllByRole("button", { name: /^Reasignar la cita de/ }).then((b) => b[0]!),
    );
    const dialogo = await screen.findByRole("dialog", { name: "Reasignar profesional" });
    expect(await within(dialogo).findByRole("radio", { name: /Ana Ruiz/ })).toBeDisabled();
    expect(within(dialogo).getByRole("radio", { name: /Carlos Pérez/ })).toBeDisabled();
    await user.click(within(dialogo).getByRole("radio", { name: /Paula Rojas/ }));
    await user.click(within(dialogo).getByRole("button", { name: "Reasignar a Paula Rojas" }));

    expect(await screen.findByText("Cita reasignada a Paula Rojas")).toBeInTheDocument();
    expect(cuerpo).toEqual({ id_empleado: 2 });
    expect(useUi.getState().citasAfectadas?.citas.map((c) => c.id_cita)).toEqual([31]);
  });
});

describe("B8 · Crear el registro médico al terminar", () => {
  const enCurso = citaDetalleDemo({ id_cita: 8, fecha: AYER, estado: "en_curso", precio_estimado: 45000 });

  it("al marcarla, completar abre C4 con la cita, su fecha y su profesional", async () => {
    const user = userEvent.setup();
    let actual = enCurso;
    servidor.use(
      http.patch(`${API}/citas/8/estado`, () => {
        actual = { ...actual, estado: "completada" };
        return ok(actual);
      }),
      http.get(`${API}/citas/8`, () => ok(actual)),
      http.get(`${API}/negocios/1/mascotas/4/resumen-salud`, () =>
        ok(resumenDemo({ mascota: { id_mascota: 4 } })),
      ),
      http.get(`${API}/negocios/1/mascotas/4/citas`, () =>
        HttpResponse.json({
          success: true,
          message: "OK",
          data: [
            { ...citaPanelDemo({ id_cita: 8, fecha: AYER, estado: "completada" }), registros_medicos: [] },
          ],
          meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false },
        }),
      ),
      ...api([enCurso]),
    );
    renderRuta(`/n/1/agenda?cita=8&fecha=${AYER}`, { usuario: usuarioDemo() });
    const panel = await screen.findByRole("dialog", { name: "Cita #8" });
    await user.click(await within(panel).findByRole("button", { name: "Completar" }));
    const dialogo = await screen.findByRole("dialog", { name: "Completar cita" });
    const casilla = within(dialogo).getByRole("checkbox", { name: /Crear el registro médico al terminar/ });
    expect(casilla).not.toBeChecked();
    await user.click(casilla);
    await user.click(within(dialogo).getByRole("button", { name: "Completar cita" }));

    const c4 = await screen.findByRole("dialog", { name: "Nuevo registro médico · Max" });
    expect(within(c4).getByLabelText("Fecha *")).toHaveValue(AYER);
    await waitFor(() =>
      expect(within(c4).getByRole("combobox", { name: "Vincular a una cita" })).toHaveTextContent(
        /Consulta general/,
      ),
    );
    expect(within(c4).getByRole("combobox", { name: "Profesional" })).toHaveTextContent("Carlos Pérez");
  });

  it("sin historial_medico.crear no aparece la casilla", async () => {
    const user = userEvent.setup();
    servidor.use(...api([enCurso]));
    renderRuta(`/n/1/agenda?cita=8&fecha=${AYER}`, {
      usuario: usuarioDemo({
        negocios: [
          negocioDemo({
            relacion: "empleado",
            rol: { id_rol: 5, nombre: "Recepción", permisos_json: { citas: ["ver", "editar"] } },
          }),
        ],
      }),
    });
    const panel = await screen.findByRole("dialog", { name: "Cita #8" });
    await user.click(await within(panel).findByRole("button", { name: "Completar" }));
    const dialogo = await screen.findByRole("dialog", { name: "Completar cita" });
    expect(within(dialogo).queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
