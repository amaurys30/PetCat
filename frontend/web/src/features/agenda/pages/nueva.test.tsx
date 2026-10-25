import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { Servicio } from "@/api/servicios";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { sumarDias } from "@/lib/agenda";
import { hoyISO } from "@/lib/format";
import { citaPanelDemo, profesionalDemo } from "@/test/agenda";
import { gestionDemo, negocioDemo, renderRuta, sedeDemo, usuarioDemo } from "@/test/render";
import { servicioDemo } from "@/test/servicios";
import { API, fallo, http, HttpResponse, ok, servidor } from "@/test/servidor";

const HOY = hoyISO();
const MANANA = sumarDias(HOY, 1);
const todosLosDias = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  dia_semana: d,
  hora_apertura: "08:00",
  hora_cierre: "18:00",
}));

const pagina = (data: Servicio[]) =>
  HttpResponse.json({
    success: true,
    message: "OK",
    data,
    meta: { total: data.length, page: 1, limit: 100, totalPages: 1, hasNext: false },
  });

const lorena = {
  id_usuario: 20,
  nombre: "Lorena",
  apellido: "Gómez",
  email: "lorena@petcat.test",
  telefono: "3001234567",
  usa_app: true,
  mascotas: [
    { id_mascota: 31, nombre: "Milo", especie: "perro", raza: "Schnauzer" },
    { id_mascota: 32, nombre: "Nina", especie: "gato", raza: null },
  ],
};

const horarios = (fecha: string) =>
  ok({
    fecha,
    servicio: { id_servicio: 1, nombre: "Consulta general", duracion_minutos: 30, precio_actual: 45000 },
    sucursal: { id_sucursal: 3, nombre: "Sede Centro" },
    horarios: [
      { hora_inicio: "08:00", hora_fin: "08:30", empleados: [] },
      { hora_inicio: "09:00", hora_fin: "09:30", empleados: [] },
    ],
    motivo_sin_horarios: null,
  });

interface Registro {
  horarios: URL[];
  crear: unknown[];
  registrar: unknown[];
}

function base(registro: Registro, { crear }: { crear?: () => Response } = {}) {
  return [
    http.get(`${API}/negocios/1/citas`, () => ok([])),
    http.get(`${API}/negocios/1/profesionales`, () => ok([profesionalDemo()])),
    http.get(`${API}/negocios/1/gestion`, () =>
      ok(gestionDemo({ sucursales: [sedeDemo({ horarios: todosLosDias })] })),
    ),
    http.get(`${API}/negocios/1/servicios`, () =>
      pagina([servicioDemo(), servicioDemo({ id_servicio: 2, nombre: "Sin cita", requiere_cita: false })]),
    ),
    http.get(`${API}/negocios/1/clientes/buscar`, ({ request }) =>
      ok(
        (new URL(request.url).searchParams.get("telefono") ?? "").replace(/\D/g, "") === "3001234567"
          ? [lorena]
          : [],
      ),
    ),
    http.get(`${API}/negocios/1/citas/horarios-libres`, ({ request }) => {
      const url = new URL(request.url);
      registro.horarios.push(url);
      return horarios(url.searchParams.get("fecha")!);
    }),
    http.post(`${API}/negocios/1/citas`, async ({ request }) => {
      registro.crear.push(await request.json());
      return (
        crear?.() ??
        HttpResponse.json(
          {
            success: true,
            message: "Cita agendada y confirmada",
            data: citaPanelDemo({ id_cita: 900, fecha: MANANA, hora_inicio: "09:00" }),
          },
          { status: 201 },
        )
      );
    }),
    http.post(`${API}/negocios/1/clientes`, async ({ request }) => {
      const cuerpo = (await request.json()) as {
        nombre: string;
        apellido: string;
        telefono?: string;
        email?: string;
      };
      registro.registrar.push(cuerpo);
      return HttpResponse.json(
        {
          success: true,
          message: "Cliente registrado sin cuenta",
          data: {
            cliente: {
              id_usuario: 50,
              nombre: cuerpo.nombre,
              apellido: cuerpo.apellido,
              email: cuerpo.email ?? null,
              telefono: cuerpo.telefono ?? null,
            },
            mascota: { id_mascota: 60, nombre: "Toby", especie: "perro" },
            sin_cuenta: !cuerpo.email,
          },
        },
        { status: 201 },
      );
    }),
  ];
}

const nuevoRegistro = (): Registro => ({ horarios: [], crear: [], registrar: [] });

async function abrir(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Nueva cita" }));
  return screen.findByRole("dialog", { name: "Nueva cita" });
}

async function elegirHasta(user: ReturnType<typeof userEvent.setup>, d: HTMLElement) {
  await user.type(within(d).getByLabelText("Buscar cliente"), "300 123 4567");
  await user.click(within(d).getByRole("button", { name: "Buscar" }));
  await user.click(await within(d).findByRole("button", { name: /Lorena Gómez/ }));
  await user.click(within(d).getByRole("radio", { name: "Milo" }));
  await user.click(within(d).getByRole("combobox", { name: "Servicio" }));
  await user.click(await screen.findByRole("option", { name: /Consulta general/ }));
  await user.click(within(d).getByRole("radiogroup", { name: "Fecha" }).querySelectorAll("button")[1]!);
}

beforeEach(() => __reiniciarSesionParaPruebas());

describe("B5 · Nueva cita", () => {
  it("busca por teléfono, elige mascota y servicio, pide horarios sin la agenda de la mascota y agenda", async () => {
    const user = userEvent.setup();
    const registro = nuevoRegistro();
    servidor.use(...base(registro));
    const { router } = renderRuta("/n/1/agenda", { usuario: usuarioDemo() });
    const d = await abrir(user);

    // Solo se ofrecen servicios que requieren cita.
    await elegirHasta(user, d);
    expect(within(d).getByText(/3001234567 · lorena@petcat.test · usa la app/)).toBeInTheDocument();
    await user.click(await within(d).findByRole("radio", { name: "09:00" }));
    const consulta = registro.horarios.at(-1)!;
    expect(consulta.searchParams.get("id_mascota")).toBe("31");
    expect(consulta.searchParams.get("fecha")).toBe(MANANA);

    await user.click(within(d).getByRole("radio", { name: "Presencial" }));
    await user.type(within(d).getByLabelText("Notas internas"), "Traer el carnet");
    await user.click(within(d).getByRole("button", { name: "Agendar cita (queda confirmada)" }));

    expect(await screen.findByText(/^Cita agendada y confirmada:/)).toBeInTheDocument();
    expect(registro.crear).toEqual([
      {
        id_usuario: 20,
        id_mascota: 31,
        id_servicio: 1,
        id_sucursal: 3,
        fecha: MANANA,
        hora_inicio: "09:00",
        origen: "presencial",
        notas_internas: "Traer el carnet",
      },
    ]);
    await waitFor(() => expect(router.state.location.search).toContain("cita=900"));
  });

  it("sin citas.ver_todas la cita queda a nombre de quien la agenda y solo ofrece sus servicios", async () => {
    const user = userEvent.setup();
    const registro = nuevoRegistro();
    servidor.use(
      ...base(registro),
      // Sin configuracion.ver, las sedes salen del perfil público.
      http.get(`${API}/negocios/1`, () => ok({ sucursales: [sedeDemo({ horarios: todosLosDias })] })),
      http.get(`${API}/negocios/1/profesionales`, () =>
        ok([
          profesionalDemo(),
          profesionalDemo({
            id_empleado: 2,
            nombre: "Paula",
            apellido: "Rojas",
            servicios: [{ id_servicio: 3, nombre: "Cirugía" }],
          }),
        ]),
      ),
      http.get(`${API}/negocios/1/servicios`, () =>
        pagina([servicioDemo(), servicioDemo({ id_servicio: 3, nombre: "Cirugía" })]),
      ),
    );
    renderRuta("/n/1/agenda", {
      usuario: usuarioDemo({
        negocios: [
          negocioDemo({
            relacion: "empleado",
            id_empleado: 1,
            rol: { id_rol: 2, nombre: "Veterinario", permisos_json: { citas: ["ver", "crear", "editar"] } },
          }),
        ],
      }),
    });
    const d = await abrir(user);

    await user.click(within(d).getByRole("combobox", { name: "Servicio" }));
    expect(await screen.findByRole("option", { name: /Consulta general/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Cirugía/ })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await elegirHasta(user, d);
    const profesional = within(d).getByRole("combobox", { name: "Profesional" });
    expect(profesional).toBeDisabled();
    expect(profesional).toHaveTextContent("Carlos Pérez");
    await user.click(await within(d).findByRole("radio", { name: "09:00" }));
    expect(registro.horarios.at(-1)!.searchParams.get("id_empleado")).toBe("1");
    await user.click(within(d).getByRole("button", { name: "Agendar cita (queda confirmada)" }));
    await waitFor(() => expect(registro.crear).toHaveLength(1));
    expect(registro.crear[0]).toMatchObject({ id_empleado: 1 });
  });

  it("sin cliente ni horario dice qué falta; el 409 lo muestra y recarga los horarios", async () => {
    const user = userEvent.setup();
    const registro = nuevoRegistro();
    servidor.use(
      ...base(registro, { crear: () => fallo(409, "El horario ya no está disponible: elige otro") }),
    );
    renderRuta("/n/1/agenda", { usuario: usuarioDemo() });
    const d = await abrir(user);
    await user.click(within(d).getByRole("button", { name: "Agendar cita (queda confirmada)" }));
    expect(within(d).getByText("Elige o registra al cliente.")).toBeInTheDocument();

    await elegirHasta(user, d);
    await user.click(await within(d).findByRole("radio", { name: "08:00" }));
    const antes = registro.horarios.length;
    await user.click(within(d).getByRole("button", { name: "Agendar cita (queda confirmada)" }));
    expect(await within(d).findByText("El horario ya no está disponible: elige otro")).toBeInTheDocument();
    await waitFor(() => expect(registro.horarios.length).toBeGreaterThan(antes));
    expect(within(d).getByRole("radio", { name: "08:00" })).toHaveAttribute("aria-checked", "false");
  });

  it("el 403 por límite del plan abre el diálogo de Pro", async () => {
    const user = userEvent.setup();
    const registro = nuevoRegistro();
    servidor.use(
      ...base(registro, {
        crear: () =>
          fallo(403, "El negocio alcanzó las 30 citas de su plan Gratuito en octubre de 2026", {
            plan: "Gratuito",
          }),
      }),
    );
    renderRuta("/n/1/agenda", { usuario: usuarioDemo() });
    const d = await abrir(user);
    await elegirHasta(user, d);
    await user.click(await within(d).findByRole("radio", { name: "09:00" }));
    await user.click(within(d).getByRole("button", { name: "Agendar cita (queda confirmada)" }));
    expect(
      await screen.findByRole("dialog", { name: "Alcanzaste el límite de tu plan" }),
    ).toBeInTheDocument();
  });

  it("sin clientes.ver no busca por nombre", async () => {
    const user = userEvent.setup();
    servidor.use(...base(nuevoRegistro()));
    renderRuta("/n/1/agenda", {
      usuario: usuarioDemo({
        negocios: [
          negocioDemo({
            relacion: "empleado",
            rol: { id_rol: 5, nombre: "Agenda", permisos_json: { citas: ["ver", "crear"] } },
          }),
        ],
      }),
    });
    const d = await abrir(user);
    expect(within(d).getByLabelText("Buscar cliente")).toHaveAttribute("placeholder", "Teléfono o correo");
    await user.type(within(d).getByLabelText("Buscar cliente"), "Lorena");
    await user.click(within(d).getByRole("button", { name: "Buscar" }));
    expect(within(d).getByText("Escribe el teléfono o el correo completos.")).toBeInTheDocument();
  });
});

describe("C3 · Registrar cliente sin app", () => {
  it("sin correo avisa que queda sin cuenta, exige la autorización y lo deja elegido con su mascota", async () => {
    const user = userEvent.setup();
    const registro = nuevoRegistro();
    servidor.use(...base(registro));
    renderRuta("/n/1/agenda", { usuario: usuarioDemo() });
    const d = await abrir(user);
    await user.type(within(d).getByLabelText("Buscar cliente"), "301 222 3344");
    await user.click(within(d).getByRole("button", { name: "Buscar" }));
    expect(await within(d).findByText("Nadie tiene ese teléfono o correo en PetCat.")).toBeInTheDocument();
    await user.click(within(d).getByRole("button", { name: "Registrar cliente sin app" }));

    const c3 = await screen.findByRole("dialog", { name: "Registrar cliente sin app" });
    expect(within(c3).getByLabelText("Teléfono *")).toHaveValue("301 222 3344");
    expect(within(c3).getByText(/cliente sin cuenta/)).toBeInTheDocument();
    await user.type(within(c3).getAllByLabelText("Nombre *")[0]!, "Jorge");
    await user.type(within(c3).getByLabelText("Apellido *"), "Pérez");
    await user.type(within(c3).getAllByLabelText("Nombre *")[1]!, "Toby");
    const sexo = within(c3).getByRole("radiogroup", { name: "Sexo" });
    expect(within(sexo).getByRole("radio", { name: "No sé" })).toHaveAttribute("aria-checked", "true");
    await user.click(within(sexo).getByRole("radio", { name: "Macho" }));
    await user.click(within(c3).getByRole("button", { name: "Registrar y agendar cita" }));
    expect(
      await within(c3).findByText("Necesitamos la autorización del cliente para registrar sus datos"),
    ).toBeInTheDocument();
    expect(registro.registrar).toEqual([]);

    await user.click(within(c3).getByRole("checkbox"));
    await user.click(within(c3).getByRole("button", { name: "Registrar y agendar cita" }));
    expect(await screen.findByText(/Jorge quedó registrado sin cuenta/)).toBeInTheDocument();
    expect(registro.registrar).toEqual([
      {
        nombre: "Jorge",
        apellido: "Pérez",
        telefono: "301 222 3344",
        autoriza_tratamiento_datos: true,
        mascota: { nombre: "Toby", especie: "perro", sexo: "macho" },
      },
    ]);
    const nueva = await screen.findByRole("dialog", { name: "Nueva cita" });
    expect(within(nueva).getByText(/Jorge Pérez/)).toBeInTheDocument();
    expect(within(nueva).getByText(/sin cuenta/)).toBeInTheDocument();
    expect(within(nueva).getByRole("radio", { name: "Toby" })).toHaveAttribute("aria-checked", "true");
  });

  it("409 por un teléfono de la familia: Buscarlo vuelve a B5 con ese cliente para agregarle la mascota", async () => {
    const user = userEvent.setup();
    servidor.use(...base(nuevoRegistro()));
    servidor.use(
      http.post(`${API}/negocios/1/clientes`, () =>
        fallo(
          409,
          "Ya hay un cliente con ese teléfono. Si es de la misma familia, búscalo por teléfono, elígelo y agrégale la mascota.",
          { telefono: "Ya hay un cliente con este teléfono" },
        ),
      ),
    );
    renderRuta("/n/1/agenda", { usuario: usuarioDemo() });
    const d = await abrir(user);
    await user.click(within(d).getByRole("button", { name: "Registrar cliente sin app" }));
    const c3 = await screen.findByRole("dialog", { name: "Registrar cliente sin app" });
    await user.type(within(c3).getAllByLabelText("Nombre *")[0]!, "Jorge");
    await user.type(within(c3).getByLabelText("Apellido *"), "Gómez");
    await user.type(within(c3).getByLabelText("Teléfono *"), "300 123 4567");
    await user.type(within(c3).getAllByLabelText("Nombre *")[1]!, "Toby");
    await user.click(within(c3).getByRole("checkbox"));
    await user.click(within(c3).getByRole("button", { name: "Registrar y agendar cita" }));
    expect(
      await within(c3).findByText(/Si es de la misma familia, búscalo por teléfono/),
    ).toBeInTheDocument();
    await user.click(within(c3).getByRole("button", { name: "Buscarlo" }));

    const nueva = await screen.findByRole("dialog", { name: "Nueva cita" });
    expect(within(nueva).getByLabelText("Buscar cliente")).toHaveValue("300 123 4567");
    await user.click(await within(nueva).findByRole("button", { name: /Lorena Gómez/ }));
    expect(within(nueva).getByRole("button", { name: /Nueva mascota/ })).toBeInTheDocument();
  });

  it("con correo anuncia la bienvenida", async () => {
    const user = userEvent.setup();
    servidor.use(...base(nuevoRegistro()));
    renderRuta("/n/1/agenda", { usuario: usuarioDemo() });
    const d = await abrir(user);
    await user.click(within(d).getByRole("button", { name: "Registrar cliente sin app" }));
    const c3 = await screen.findByRole("dialog", { name: "Registrar cliente sin app" });
    await user.type(within(c3).getByLabelText("Correo electrónico"), "jorge@correo.co");
    expect(within(c3).getByText(/correo de bienvenida de Clínica Veterinaria Patitas/)).toBeInTheDocument();
    expect(within(c3).getByLabelText("Teléfono")).toBeInTheDocument();
  });
});
